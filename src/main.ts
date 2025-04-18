import { App, MarkdownView, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, EventRef, Notice, addIcon, Modal, WorkspaceLeaf, ItemView, Menu } from 'obsidian';
import { LLMTaskService, RedeemTaskModal } from './core/CoreServices';
import { ThemeService } from './features/themeService';
import { StatCardService, StatCardModal } from './features/StatCardService';
import { TaskAssessmentService } from './features/task-assessment-service';
import { TaskStorageRibbonIcon, TaskStorageViewer, TASK_STORAGE_VIEW_TYPE } from './views/task-storage-viewer';
import { ItemStoreService, ItemStoreModal } from './features/itemStore';
import { ItemCrafterModal } from './features/itemCrafter';
import { ProcessingIndicatorService } from './support/indicator';
import { InventoryTabView } from './views/inventory';
import { DebugMenu } from './debug/DebugMenu';
import { GamifySettingTab } from './settings/settings-tab';
import { GamifyPluginSettings, StatCardData, LLMModel } from './core/types';
import { AchievementsService } from './features/achievements';
import { RibbonManager } from './core/ribbon';
import { NotificationListener, NotificationModal, addNotificationSettingsUI } from './support/notificationListener';

type DifficultyLevel = "very_hard" | "hard" | "medium" | "easy";

const DEFAULT_SETTINGS: GamifyPluginSettings = {
	xpPerCharacter: 0.1,
	pointsBaseValue: 10,
	tagMultipliers: {
		'#easy': 0.5,
		'#medium': 1.0,
		'#hard': 2.0,
		'#veryhard': 5.0
	},
	apiUrl: 'http://localhost:1234',
	apiKey: 'your-api-key',
	themeId: 'gamesystem',
	useStatusBarIndicator: true,
	useRibbonIndicator: true,	
	trackedNotes: [],
	selectedLLMModel: 'local-model',
    rateLimiting: {
        enabled: true,
        requestsPerMinute: 10 //minutes
    },
    LLM_param: {
        enabled: false,
        temp: 0.7,
        max_tokens: 300,
        stream: false
    },	
	scanInterval: 5, //minutes
    deductPointsForUnchecking: true,
	debugMode: false,
	enableInventoryTab: true,
	inventoryPositions: {},
    ribbonButtons: {
        taskScan: true,
        inventory: true,
        store: true,
        request: true,
        achievements: true,
        refresh: true,
        reload: false,
        settings: true
    },
	notification: {
		maxNotificationsToStore: 50,
		enableNotificationCapture: true
	}
};

export default class GamifyPlugin extends Plugin {
	settings: GamifyPluginSettings;
	statCardData: StatCardData;
    statCardService: StatCardService;
    llmTaskService: LLMTaskService;
    availableModels: LLMModel[] = [];
	itemStoreService: ItemStoreService;
	taskAssessmentService: TaskAssessmentService;
	achievementsService: AchievementsService;
	
	fileChangedEventRef: EventRef;
	typing: {
		characterCount: number;
		timeout: NodeJS.Timeout | null;
	};
    themeService: ThemeService;
	processingIndicatorService: ProcessingIndicatorService;
    ribbonManager: RibbonManager;
	notificationListener: NotificationListener;

    private requestQueue: Array<() => Promise<any>> = [];
    private processingQueue = false;
    private lastRequestTime = 0;
    private inventoryView: InventoryTabView | null = null;

	private scanIntervalId: NodeJS.Timeout | null = null;
	private effectsCheckIntervalId: NodeJS.Timeout | null = null;
	private autoSaveIntervalId: NodeJS.Timeout | null = null;
	
	private async loadVaultQuestStyles() {
		const styleFile = `${this.manifest.dir}/styles.css`;
		const existing = document.getElementById("vaultquest-stylesheet");

		if (existing) existing.remove();

		try {
			const file = this.app.vault.getAbstractFileByPath(styleFile);
			if (file && file instanceof TFile) {
				const content = await this.app.vault.read(file);
				const styleElement = document.createElement("style");
				styleElement.id = "vaultquest-stylesheet";
				styleElement.textContent = content;
				document.head.appendChild(styleElement);
			} else {
				console.warn(`VaultQuest: Stylesheet not found at ${styleFile}`);
			}
		} catch (error) {
			console.error("VaultQuest: Failed to load styles.css", error);
		}
	}

	startAutoSave() {
		if (this.autoSaveIntervalId) clearInterval(this.autoSaveIntervalId);

		this.autoSaveIntervalId = setInterval(() => {
			this.saveStatCardData();
		}, this.settings.scanInterval * 60 * 1000);
	}

	startPeriodicScanning() {
		if (this.scanIntervalId) clearInterval(this.scanIntervalId);

		this.scanIntervalId = setInterval(() => {
			this.taskAssessmentService.assessCompletedTasks();
		}, this.settings.scanInterval * 60 * 1000);
	}

	startPeriodicEffectsCheck() {
		if (this.effectsCheckIntervalId) clearInterval(this.effectsCheckIntervalId);
		
		this.effectsCheckIntervalId = setInterval(() => {
			this.checkForExpiredEffects();
			
		}, this.settings.scanInterval * 60 * 1000);
	}
	
	hasDebugPermission(): boolean {
		return this.settings.debugMode && 
			   this.statCardData && 
			   this.statCardData.titles && 
			   this.statCardData.titles.some(titles => titles.id === 'debugger');
	}

	async onload() {
		this.app.workspace.onLayoutReady(async () => {
			await this.loadSettings();
			await this.loadStatCardData();
			this.achievementsService = new AchievementsService(this);
			await this.achievementsService.initialize();			
			this.app.workspace.containerEl.classList.add("vaultquest-styles");
			this.statCardService = new StatCardService(this);
			this.llmTaskService = new LLMTaskService(this);
			this.itemStoreService = new ItemStoreService(this);
			this.themeService = new ThemeService(this);
			this.statCardService.initializeUI();
			this.statCardService.refreshUI();
			this.taskAssessmentService = new TaskAssessmentService(this);
			this.startPeriodicScanning();
			this.startPeriodicEffectsCheck();
			this.achievementsService.checkForAchievements();

			new TaskStorageRibbonIcon(this, this.taskAssessmentService);
			
			this.ribbonManager = new RibbonManager(this);
			await this.ribbonManager.initialize();
					
			this.processingIndicatorService = new ProcessingIndicatorService(this);
						
			this.notificationListener = new NotificationListener(this, this.settings.notification);
			await this.notificationListener.loadNotifications();
			this.notificationListener.initialize();


			this.addCommand({
				id: 'open-item-crafter',
				name: 'Open Item Crafter',
				callback: () => {
					new ItemCrafterModal(this.app, this).open();
				}
			});

			
			this.addCommand({
			  id: 'open-notification-history',
			  name: 'Show Notification History',
			  callback: () => {
				new NotificationModal(this.app, this.notificationListener).open();
			  }
			});
			
			this.registerView(
				"inventory-view",
				(leaf) => new InventoryTabView(leaf, this)
			);			

			this.typing = {
				characterCount: 0,
				timeout: null
			};

			this.registerDomEvent(document, 'keydown', (evt: KeyboardEvent) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view && this.isContentKey(evt)) {
					this.handleTyping();
				}
			});

			this.registerView(
				TASK_STORAGE_VIEW_TYPE,
				(leaf) => new TaskStorageViewer(leaf, this, this.taskAssessmentService)
			);

			this.addCommand({
				id: "open-task-storage",
				name: "Open Task Storage",
				callback: () => {
					this.activateTaskStorageTab();
				}
			});

			new TaskStorageRibbonIcon(this, this.taskAssessmentService);
            
			this.initializeCommands();
						
			this.addSettingTab(new GamifySettingTab(this.app, this));
			await this.statCardService.refreshUI();
			this.startAutoSave();
			window.addEventListener("beforeunload", async () => {
				await this.saveStatCardData();		
			});
		});		
	}

	initializeCommands() {
		this.addCommand({
			id: 'track-current-note',
			name: 'Track Current Note for Tasks',
			callback: () => this.trackCurrentNote()
		});
		
		this.addCommand({
			id: 'untrack-note',
			name: 'Remove Note from Task Tracking',
			callback: () => this.showUntrackNoteModal()
		});
		
		this.addCommand({
			id: 'scan-tasks',
			name: 'Scan Completed Tasks',
			callback: () => this.taskAssessmentService.assessCompletedTasks()
		});

		this.addCommand({
			id: 'open-inventory',
			name: 'Open Inventory',
			callback: () => this.activateInventoryTab(),
		});
		
		this.addCommand({
			id: 'open-vq-item-store',
			name: 'Open Store',
			callback: () => new ItemStoreModal(this.app, this, this.itemStoreService).open(),
		});			
		
		this.addCommand({
			id: 'open-debug-menu',
			name: 'Open Debug Menu',
			callback: () => {
				if (this.hasDebugPermission()) {
					new DebugMenu(this.app, this).open();
				} else {
					new Notice("Debug access denied.");
				}
			}
		});
	}

	async onunload() {
		if (this.typing.timeout) {
			clearTimeout(this.typing.timeout);
			this.processTypingXp();
		}
        if (this.processingIndicatorService) {
            this.processingIndicatorService.destroy();
        }		
		if (this.autoSaveIntervalId) {
			clearInterval(this.autoSaveIntervalId);
			this.autoSaveIntervalId = null;
		}

		if (this.scanIntervalId) {
			clearInterval(this.scanIntervalId);
			this.scanIntervalId = null;
		}

		const styleEl = document.getElementById('gamify-styles');
		if (styleEl) styleEl.remove();
		
		this.app.vault.offref(this.fileChangedEventRef);

		if (this.effectsCheckIntervalId) {
			clearInterval(this.effectsCheckIntervalId);
			this.effectsCheckIntervalId = null;
		}
		
		this.notificationListener.cleanup();
		
		await this.saveStatCardData();
	}
	
	hasInfiniteInventory(): boolean {
		return this.statCardData.ownedItems?.includes('infinite_inventory') || false;
	}

	updateStreak() {
		const today = new Date().toISOString().split('T')[0]; 
		const lastActive = this.statCardData.streaks.lastActiveDate;

		if (lastActive === today) {
			return; 
		}

		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yesterdayStr = yesterday.toISOString().split('T')[0];

		if (lastActive === yesterdayStr) {
			this.statCardData.streaks.currentStreak += 1;
		} else {
			this.statCardData.streaks.currentStreak = 1;
		}

		if (this.statCardData.streaks.currentStreak > this.statCardData.streaks.longestStreak) {
			this.statCardData.streaks.longestStreak = this.statCardData.streaks.currentStreak;
		}

		this.statCardData.streaks.lastActiveDate = today;
	}
	
	async activateTaskStorageTab() {
		const { workspace } = this.app;
		const existingLeaves = workspace.getLeavesOfType(TASK_STORAGE_VIEW_TYPE);

		if (existingLeaves.length > 0) {
			workspace.revealLeaf(existingLeaves[0]);
			return;
		}

		const leaf = workspace.getLeaf('tab');
		await leaf.setViewState({ type: TASK_STORAGE_VIEW_TYPE, active: true });
		workspace.revealLeaf(leaf);
	}

	async activateInventoryTab() {
		if (!this.settings.enableInventoryTab) {
			new Notice("Inventory tab is disabled in settings");
			return;
		}
		if (!this.hasInfiniteInventory()) {
			new Notice("You need to acquire the 'Infinite Inventory' item first!");
			return;
		}
		
		const existingLeaves = this.app.workspace.getLeavesOfType("inventory-view");
		
		if (existingLeaves.length > 0) {
			this.app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}
		
		const leaf = this.app.workspace.getLeaf('tab');
		
		if (leaf) {
			await leaf.setViewState({
				type: "inventory-view",
				active: true,
			});
			
			this.app.workspace.revealLeaf(leaf);
		}       
	}

	isContentKey(evt: KeyboardEvent): boolean {
		return !evt.ctrlKey && !evt.altKey && !evt.metaKey && 
			evt.key.length === 1 && !evt.repeat;
	}

	handleTyping() {
		this.typing.characterCount++;
		
		if (this.typing.timeout) {
			clearTimeout(this.typing.timeout);
		}
		
		this.typing.timeout = setTimeout(() => {
			this.processTypingXp();
		}, 2000);
	}

	processTypingXp() {
		const xpGained = this.typing.characterCount * this.settings.xpPerCharacter;
		this.statCardData.xp += xpGained;
		this.statCardData.writingStats.totalCharactersTyped += this.typing.characterCount;		
		this.typing.characterCount = 0;
		this.typing.timeout = null;
		this.checkForLevelUp();
		this.achievementsService.checkForAchievements();
		this.statCardService.refreshUI();
	}

	async trackCurrentNote() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file to track.');
			return;
		}
		
		const filePath = activeFile.path;
		if (!this.settings.trackedNotes.includes(filePath)) {
			this.settings.trackedNotes.push(filePath);
			await this.saveSettings();
			new Notice(`Now tracking "${activeFile.basename}" for tasks.`);
			await this.saveStatCardData();

		} else {
			new Notice(`Already tracking "${activeFile.basename}".`);
		}
	}

	async showUntrackNoteModal() {
		if (this.settings.trackedNotes.length === 0) {
			new Notice('No notes are currently being tracked.');
			return;
		}
		
		const modal = new SelectNoteModal(
			this.app, 
			this.settings.trackedNotes,
			async (selectedPath) => {
				this.settings.trackedNotes = this.settings.trackedNotes.filter(path => path !== selectedPath);
				await this.saveSettings();
				new Notice(`Stopped tracking "${selectedPath.split('/').pop()}".`);
				await this.saveStatCardData();
			}
		);
		
		modal.open();
	}
	
	extractTags(text: string): string[] {
		const tagRegex = /#[\w-]+/g;
		return (text.match(tagRegex) || []);
	}

	async calculatePointsForTask(taskText: string, tags: string[]): Promise<number> {
		try {
			return await this.calculatePointsWithLLM(taskText, tags);
		} catch (error) {
			console.error("Error calculating points with LLM:", error);
			return this.calculateBasicPoints(tags);
		}
	}

	calculateBasicPoints(tags: string[]): number {
		let multiplier = 1.0;
		
		for (const tag of tags) {
			if (this.settings.tagMultipliers[tag]) {
				multiplier = Math.max(multiplier, this.settings.tagMultipliers[tag]);
			}
		}
		
		return Math.round(this.settings.pointsBaseValue * multiplier);
	}

	async calculatePointsWithLLM(taskText: string, tags: string[]): Promise<number> {
		const functions = [
			{
				"name": "assign_points",
				"description": "Assign points to a completed task based on its difficulty",
				"parameters": {
					"type": "object",
					"properties": {
						"points": {
							"type": "number",
							"description": "The number of points to award for the task"
						},
						"reasoning": {
							"type": "string",
							"description": "Explanation of how points were calculated"
						},
						"difficulty_assessment": {
							"type": "string",
							"enum": ["easy", "medium", "hard", "very_hard"],
							"description": "Assessment of the task's difficulty"
						}
					},
					"required": ["points", "reasoning", "difficulty_assessment"]
				}
			}
		];

		const messages = [
			{
				"role": "system",
				"content": "You are a task assessment system that assigns points to completed tasks based on their difficulty. For difficulty, consider the complexity of the task and any tags."
			},
			{
				"role": "user",
				"content": `I just completed this task: "${taskText}". Tags: ${tags.join(', ') || 'None'}. Please assign appropriate points.`
			}
		];
        return await this.rateLimit(() => this.callLLMApi(functions, messages));
	}
    
    async rateLimit<T>(fn: () => Promise<T>): Promise<T> {
        if (!this.settings.rateLimiting.enabled) {
            return fn();
        }
        
        return new Promise<T>((resolve, reject) => {
            this.requestQueue.push(async () => {
                try {
                    const result = await fn();
                    resolve(result);
                    return result;
                } catch (error) {
                    reject(error);
                    throw error;
                }
            });
            
            if (!this.processingQueue) {
                this.processQueue();
            }
        });
    }
    
    async processQueue() {
        if (this.requestQueue.length === 0) {
            this.processingQueue = false;
            return;
        }
        
        this.processingQueue = true;
        
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minDelay = (60 * 1000) / this.settings.rateLimiting.requestsPerMinute;
        const delay = Math.max(0, minDelay - timeSinceLastRequest);
        
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const nextRequest = this.requestQueue.shift();
        if (nextRequest) {
            this.lastRequestTime = Date.now();
            try {
                await nextRequest();
            } catch (error) {
                console.error("Error in rate-limited request:", error);
            }
        }
        
        this.processQueue();
    }
    
    async callLLMApi(functions: any[], messages: any[]): Promise<number> {
        try {
            const response = await fetch(`${this.settings.apiUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.settings.apiKey}`
                },
                body: JSON.stringify({
                    model: this.settings.selectedLLMModel,
                    messages: messages,
                    tools: [{ "type": "function", "function": functions[0] }],
                    tool_choice: { "type": "function", "function": { "name": "assign_points" } }
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} - ${await response.text()}`);
            }

            const data = await response.json();
            
            if (data.choices && data.choices[0] && data.choices[0].message && 
                data.choices[0].message.tool_calls && data.choices[0].message.tool_calls[0]) {
                
                const toolCall = data.choices[0].message.tool_calls[0];
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                this.updateDifficultyStats(functionArgs.difficulty_assessment);
                
                return Math.round(functionArgs.points);
            }
            
            throw new Error("Could not extract points from LLM response");
        } catch (error) {
            console.error("Error calling LLM:", error);
            throw error;
        }
    }

	updateDifficultyStats(difficultyAssessment: string) {
		const difficultyMap: Record<DifficultyLevel, number> = {
			"very_hard": 4,
			"hard": 3,
			"medium": 2,
			"easy": 1
		};
		
		const key = difficultyAssessment as DifficultyLevel;
		const difficultyLevel = (key in difficultyMap) ? difficultyMap[key] : 0;
		
		if (difficultyLevel > this.statCardData.stats.highestDifficulty) {
			this.statCardData.stats.highestDifficulty = difficultyLevel;
		}
	}
	
	async checkForLevelUp() {
		while (this.statCardData.xp >= this.statCardData.nextLevelXp) {
			this.statCardData.xp -= this.statCardData.nextLevelXp;
			this.statCardData.level++;
			
			// Increase required XP for next level
			this.statCardData.nextLevelXp = Math.round(this.statCardData.nextLevelXp * (1.1));
			
			new Notice(`Congratulations! You reached level ${this.statCardData.level}!`);
			const levelUpReward = Math.round(10 + (this.statCardData.level * 2) + (this.statCardData.level ** 1.5));
			this.statCardData.points += levelUpReward;
			new Notice(`You've been awarded ${levelUpReward} tokens!`);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async loadStatCardData(): Promise<void> {
		try {
			const dataFile = this.app.vault.getAbstractFileByPath('QuestLog/data.json');
			if (dataFile instanceof TFile) {
				const content = await this.app.vault.read(dataFile);
				const parsedData = JSON.parse(content);
				this.statCardData = parsedData.statCardData || parsedData;
			} else {
				this.initializeDefaultStatCardData();
				await this.saveStatCardData();
			}
		} catch (error) {
			console.error("Error loading user data:", error);
			this.initializeDefaultStatCardData();
		}
	}

    checkForExpiredEffects() {
        if (!this.statCardData.activeEffects) return;
        const now = Date.now();
        let effectsChanged = false;
        for (const [key, effect] of Object.entries(this.statCardData.activeEffects)) {
            if (effect.expiresAt && effect.expiresAt < now) {
                delete this.statCardData.activeEffects[key];
                new Notice(`Your ${key} effect has expired.`);
                effectsChanged = true;
            }
        }
    }
	
	initializeDefaultStatCardData() {
		this.statCardData = {
			xp: 0,
			level: 1,
			points: 0,
			nextLevelXp: 100,
			skills: [
				{
					id: "writing",
					name: "Writing",
					level: 1,
					xp: 0
				},
				{
					id: "research",
					name: "Research",
					level: 1,
					xp: 0
				},
				{
					id: "organization",
					name: "Organization",
					level: 1,
					xp: 0
				}
			],
			items: [],
			achievements: [],
			titles: [],
			stats: {
				tasksCompleted: 0,
				totalPointsEarned: 0,
				highestDifficulty: 0,
				tasksUnchecked: 0, 
				totalPointsDeducted: 0,
				itemsPurchased: 0,
				lastFileCount: 0,
				lastFolderCount: 0
			},
			ownedItems: [],
			activeEffects: {},
			writingStats: { totalCharactersTyped: 0 },
			streaks: { currentStreak: 0, longestStreak: 0, lastActiveDate: "" }			
		};
	}

	async saveStatCardData(): Promise<void> {
		try {
			const folderPath = 'QuestLog';
			const filePath = `${folderPath}/data.json`;

			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			if (!folder) {
				await this.app.vault.createFolder(folderPath);
				console.log(`Created plugin data folder: ${folderPath}`);
			}

			const folderPath2 = "QuestLog/StoreInventory";
			const folder2 = this.app.vault.getAbstractFileByPath(folderPath2);
			if (!folder2) {
				await this.app.vault.createFolder(folderPath2);
				console.log(`Created plugin data folder: ${folderPath2}`);
				new Notice(`You can add custom items in '${folderPath2}'.`);
			}
			console.log(`Loading custom items from: ${folderPath2}`);

			const data = JSON.stringify({ statCardData: this.statCardData }, null, 2);
			const dataFile = this.app.vault.getAbstractFileByPath(filePath);

			if (dataFile instanceof TFile) {
				await this.app.vault.modify(dataFile, data);
			} else {
				await this.app.vault.create(filePath, data);
				new Notice(`Log: Database Created.`);
			}
		} catch (error) {
			console.error("Error saving user data:", error);
			new Notice("Error saving progress data.");
		}
	}
	
    async fetchAvailableModels(): Promise<LLMModel[]> {
        try {
            const response = await fetch(`${this.settings.apiUrl}/v1/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error("Error fetching models:", error);
            return [];
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            const response = await fetch(`${this.settings.apiUrl}/v1/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`
                }
            });

            return response.ok;
        } catch (error) {
            console.error("Error testing connection:", error);
            return false;
        }
    }
}

class SelectNoteModal extends Modal {
	options: string[];
	onSelect: (selected: string) => void;
	
	constructor(app: App, options: string[], onSelect: (selected: string) => void) {
		super(app);
		this.options = options;
		this.onSelect = onSelect;
	}
	
	onOpen() {
		const {contentEl} = this;
		
		contentEl.createEl("h2", {text: "Select Note to Untrack"});
		
		const ul = contentEl.createEl("ul", {cls: "gamify-modal-list"});
		
		this.options.forEach(option => {
			const li = ul.createEl("li");
			li.textContent = option;
			li.addEventListener("click", () => {
				this.onSelect(option);
				this.close();
			});
		});
	}
	
	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
