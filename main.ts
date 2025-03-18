import { App, MarkdownView, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, EventRef, Notice, addIcon, Modal, WorkspaceLeaf, ItemView, Menu } from 'obsidian';
import { StatCardService, LLMTaskService, ThemeService, RedeemTaskModal } from './services';
import { TaskAssessmentService } from './task-assessment-service';
import { TaskStorageRibbonIcon } from './task-storage-viewer';
import { ItemStoreService, ItemStoreModal } from './itemStore';
import { ProcessingIndicatorService } from './indicator';
import { InventoryTabView } from './inventory';

interface GamifyPluginSettings {
	userFavicon?: string;
	xpPerCharacter: number;
	pointsBaseValue: number;
	tagMultipliers: Record<string, number>;
	apiUrl: string;
	apiKey: string;
	themeId: string;
	customTheme?: Theme;
	trackedNotes: string[];
	selectedLLMModel: string;
    rateLimiting: {
        enabled: boolean;
        requestsPerMinute: number;
    };
    scanInterval: number;
    deductPointsForUnchecking: boolean;
    debugMode: boolean;
	enableInventoryTab: boolean;
	inventoryPositions: Record<string, {row: number, col: number}>;
}

interface ItemInfo {
    cost: number;
    effect: string;
}

interface ItemStore {
    [key: string]: ItemInfo;
}

interface LLMModel {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}

interface StatCardData {
	xp: number;
	level: number;
	points: number;
	nextLevelXp: number;
	skills: Skill[];
	items: Item[];
	achievements: Achievement[];
	titles: Titles[];
	stats: Stats;
    ownedItems: string[];
    activeEffects: { 
        [key: string]: {
            value: number;
            expiresAt: number;
        }
    };
    activeTheme?: string; 
    hasFamiliar?: boolean;
    lastFamiliarBonusDate?: string;
    writingStats: { totalCharactersTyped: number };
    streaks: { currentStreak: number, longestStreak: number, lastActiveDate: string };
}

interface Skill {
	id: string;
	name: string;
	level: number;
	xp: number;
}

interface Item {
	id: string;
	name: string;
	description: string;
	cost: number;
	unlockedAt: string;	
	effect: string[];
}

interface Achievement {
	id: string;
	name: string;
	description: string;
	unlockedAt: string;
	effect?: string[];
    condition: { type: string; value: number };
    reward: { type: string; value: any };	
}
		
interface Titles {
	id: string;
	name: string;
	description: string;
	unlockedAt: string;
	effect: string[];
}

interface Stats {
	tasksCompleted: number;
	totalPointsEarned: number;
	highestDifficulty: number;
    tasksUnchecked: number;
    totalPointsDeducted: number;
	itemsPurchased: number;	
	lastFileCount: number;
	lastFolderCount: number;
}

interface ProcessedTask {
	filePath: string;
	taskText: string;
	completedOn: string;
}

interface Theme {
    id: string;
    name: string;
    uiElements: {
        grimoire: string;
        level: string;
        points: string;
        xp: string;
        skills: string;
        summonPowers: string;
        tasksCompleted: string;
        redeemButton: string;
        storeButton: string;
		inventory: string,
		settings: string
    };
    flavor: {
        taskSystem: string; 
        pointsSystem: string;
        levelSystem: string;
        systemMessage: string;
    };
}

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
	trackedNotes: [],
	selectedLLMModel: 'local-model',
    rateLimiting: {
        enabled: true,
        requestsPerMinute: 10 //minutes
    },	
	scanInterval: 5, //minutes
    deductPointsForUnchecking: true,
	debugMode: false,
	enableInventoryTab: true,
	inventoryPositions: {},
};

export default class GamifyPlugin extends Plugin {
	settings: GamifyPluginSettings;
	statCardData: StatCardData;
    statCardService: StatCardService;
    llmTaskService: LLMTaskService;
    availableModels: LLMModel[] = [];
	itemStoreService: ItemStoreService;
	taskAssessmentService: TaskAssessmentService;
	customAchievements: Achievement[] = [];
	defaultAchievements: Achievement[] = [];
	fileChangedEventRef: EventRef;
	typing: {
		characterCount: number;
		timeout: NodeJS.Timeout | null;
	};
    themeService: ThemeService;
	processingIndicatorService: ProcessingIndicatorService;
   
    private requestQueue: Array<() => Promise<any>> = [];
    private processingQueue = false;
    private lastRequestTime = 0;
    private inventoryView: InventoryTabView | null = null;

	private scanIntervalId: NodeJS.Timeout | null = null;
	
	private effectsCheckIntervalId: NodeJS.Timeout | null = null;
	
	private loadVaultQuestStyles() {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.type = "text/css";
		link.href = this.app.vault.adapter.getResourcePath(`${this.manifest.dir}/styles.css`);
		link.id = "vaultquest-stylesheet";

		const existing = document.getElementById("vaultquest-stylesheet");
		if (existing) existing.remove();

		document.head.appendChild(link);
	}

	private autoSaveIntervalId: NodeJS.Timeout | null = null;

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
			await this.loadCustomAchievements();
			this.app.workspace.containerEl.classList.add("vaultquest-styles");
			this.statCardService = new StatCardService(this);
			this.llmTaskService = new LLMTaskService(this);
			this.itemStoreService = new ItemStoreService(this);
			this.themeService = new ThemeService(this);
			this.statCardService.initializeUI();
			this.statCardService.refreshUI();
			this.taskAssessmentService = new TaskAssessmentService(this);
			this.taskAssessmentService.initializeTaskStorage();	
			this.startPeriodicScanning();
			this.startPeriodicEffectsCheck();
			this.checkForAchievements();
			new TaskStorageRibbonIcon(this, this.taskAssessmentService);
			
			await this.addRibbonIcon("check-circle", "Scan for Tasks", () => {
				this.taskAssessmentService.assessCompletedTasks();
				new Notice("Manual scan started.");
			});	
			
			if (this.statCardData.ownedItems?.includes('infinite_inventory')) { 
			this.addRibbonIcon("package", "Open Inventory", () => {
				this.activateInventoryTab();
			});			
			}
			
			this.addRibbonIcon("store", "Open Store", () => {
				new ItemStoreModal(this.app, this, this.itemStoreService).open();				
			});			
			
			if (this.statCardData.ownedItems?.includes('mysterious_tablet')) {
				this.addRibbonIcon("zap", "Request", () => {
					new RedeemTaskModal(this.app, this).open();
				});
			}
			
			await this.addRibbonIcon("refresh-cw", "Refresh VaultQuest UI", () => {
				this.checkForLevelUp();
				this.checkForAchievements();
				this.statCardService.refreshUI();
			});			        
					
			this.processingIndicatorService = new ProcessingIndicatorService(this);
			this.processingIndicatorService.initializeUI();		
			
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
						
			this.addSettingTab(new GamifySettingTab(this.app, this));
			await this.statCardService.refreshUI();
			this.startAutoSave();
		});		
	}

	async onunload() {
		if (this.typing.timeout) {
			clearTimeout(this.typing.timeout);
			this.processTypingXp();
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
		await this.saveStatCardData();
	}
	
	hasInfiniteInventory(): boolean {
		return this.statCardData.ownedItems?.includes('infinite_inventory') || false;
	}

	async loadCustomAchievements(): Promise<void> {
		this.customAchievements = [];
		try {
			const dataFile = this.app.vault.getAbstractFileByPath('QuestLog/Achievements.json');
			if (dataFile instanceof TFile) {
				const content = await this.app.vault.read(dataFile);
				const parsedData = JSON.parse(content);
				this.customAchievements = parsedData;
			} else {
				console.warn("Achievements.json not found. Creating default file...");
				await this.createDefaultAchievementsFile();
			}
		} catch (error) {
			console.error("Error loading Achievements.json:", error);
		}
	}

	async createDefaultAchievementsFile(): Promise<void> {
		const defaultAchievements = JSON.stringify([
			{
				"id": "wordsmith",
				"name": "Wordsmith",
				"description": "Write 10,000 characters",
				"condition": { "type": "writing", "value": 10000 },
				"reward": { "type": "xp", "value": 1000 }
			}
		], null, 2);

		try {
			await this.app.vault.create('QuestLog/Achievements.json', defaultAchievements);
			console.log("Default Achievements.json created.");
		} catch (error) {
			console.error("Error creating default Achievements.json:", error);
		}
	}

	async checkForAchievements() {
		const allAchievements = [
			...this.defaultAchievements,
			...this.customAchievements
		];

		allAchievements.forEach(achievement => {
			if (!this.statCardData.achievements.some(a => a.id === achievement.id) && this.isAchievementConditionMet(achievement.condition)) {
				this.statCardData.achievements.push(achievement);
				this.applyAchievementReward(achievement.reward);
				new Notice(`🎉 Achievement Unlocked: ${achievement.name}!`);
			}
		});
	}

	isAchievementConditionMet(condition: { type: string; value: number }): boolean {
		switch (condition.type) {
			case "writing":
				return this.statCardData.writingStats.totalCharactersTyped >= condition.value;
			case "tasks_completed":
				return this.statCardData.stats.tasksCompleted >= condition.value;
			case "streak":
				return this.statCardData.streaks.currentStreak >= condition.value;
			case "level":
				return this.statCardData.level >= condition.value;
			case "notes_created":
				return this.statCardData.stats.lastFileCount >= condition.value;
			case "items_purchased":
				return this.statCardData.stats.itemsPurchased >= condition.value;				
			case "point_collected":
				return this.statCardData.stats.totalPointsEarned >= condition.value;				
			default:
				return false;
		}
	}

	applyAchievementReward(reward: { type: string; value: any }) {
		this.statCardData.activeEffects = this.statCardData.activeEffects || {};

		switch (reward.type) {
			case "xp":
				this.statCardData.xp += reward.value;
				this.checkForLevelUp();
				break;

			case "points":
				this.statCardData.points += reward.value;
				break;

			case "title":
				if (!this.statCardData.titles.some(t => t.id === reward.value)) {
					this.statCardData.titles.push({
						id: reward.value,
						name: reward.value,
						description: `Unlocked by an achievement`,
						unlockedAt: new Date().toISOString(),
						effect: []
					});
				}
				break;

			case "temp_xp_multiplier":
				this.statCardData.activeEffects.xpMultiplier = {
					value: reward.value,
					expiresAt: Date.now() + (24 * 60 * 60 * 1000) 
				};
				new Notice(`🎉 XP Boost Activated! +${(reward.value - 1) * 100}% XP for 24 hours!`);
				break;

			case "perm_xp_multiplier":
				this.statCardData.activeEffects.xpMultiplier = {
					value: reward.value,
					expiresAt: Date.now() + (24 * 60 * 60 * 1000 * 365) 
				};
				new Notice(`Semi-Permanent XP Boost! You now gain +${(reward.value - 1) * 100}% more XP for 365 days.`);
				break;
			case "temp_discount":
				this.statCardData.activeEffects.storeDiscount = {
					value: reward.value,
					expiresAt: Date.now() + (24 * 60 * 60 * 1000)  
				};
				new Notice(`💰 You unlocked a ${reward.value * 100}% discount on purchases for 24 hours!`);
				break;

			case "perm_discount":
				this.statCardData.activeEffects.storeDiscount = {
					value: reward.value,
					expiresAt: Date.now() + (24 * 60 * 60 * 1000 * 365) 
				};
				new Notice(`🛒 Semi-Permanent Discount! All items are now ${reward.value * 100}% cheaper for 365 days.`);
				break;

			default:
				new Notice(`You obtained an unknown reward.`);
				console.warn(`Unknown reward type: ${reward.type}`);
		}
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
		this.checkForAchievements();
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
		// Prepare the query for the LLM - works fine - use file templates? - revisit
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
                
                if (functionArgs.difficulty_assessment === "very_hard" && 
                    this.statCardData.stats.highestDifficulty < 4) {
                    this.statCardData.stats.highestDifficulty = 4;
                } else if (functionArgs.difficulty_assessment === "hard" && 
                    this.statCardData.stats.highestDifficulty < 3) {
                    this.statCardData.stats.highestDifficulty = 3;
                } else if (functionArgs.difficulty_assessment === "medium" && 
                    this.statCardData.stats.highestDifficulty < 2) {
                    this.statCardData.stats.highestDifficulty = 2;
                } else if (functionArgs.difficulty_assessment === "easy" && 
                    this.statCardData.stats.highestDifficulty < 1) {
                    this.statCardData.stats.highestDifficulty = 1;
                }
                
                return Math.round(functionArgs.points);
            }
            
            throw new Error("Could not extract points from LLM response");
        } catch (error) {
            console.error("Error calling LLM:", error);
            throw error;
        }
    }

	async checkForLevelUp() {
		while (this.statCardData.xp >= this.statCardData.nextLevelXp) {
			this.statCardData.xp -= this.statCardData.nextLevelXp;
			this.statCardData.level++;
			
			// Increase required XP for next level - find better eqn
			this.statCardData.nextLevelXp = Math.round(this.statCardData.nextLevelXp * (1.1 + this.statCardData.level * 0.05));
			
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
        if (effectsChanged) {
            //this.saveStatCardData();
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

			new Notice("Log: Database Updated");
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

class GamifySettingTab extends PluginSettingTab {
	plugin: GamifyPlugin;
    modelDropdown: HTMLSelectElement;
	
	constructor(app: App, plugin: GamifyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
    private hasSystemControlAccess(): boolean {
        return this.plugin.statCardData && 
               this.plugin.statCardData.ownedItems && 
               this.plugin.statCardData.ownedItems.includes('system_control');
    }
	
    async display(): Promise<void> {
		const {containerEl} = this;

		containerEl.empty();
		
		containerEl.createEl('h2', {text: 'Tracked Notes'});
		
		const trackedNotesContainer = containerEl.createDiv();
		
		if (this.plugin.settings.trackedNotes.length === 0) {
			trackedNotesContainer.createEl('p', {
				text: 'No notes are currently being tracked. Use the "Track Current Note for Tasks" command to start tracking notes.'
			});
		} else {
			const ul = trackedNotesContainer.createEl('ul');
			this.plugin.settings.trackedNotes.forEach(path => {
				const li = ul.createEl('li');
				li.createEl('span', {text: path});
				
				const removeButton = li.createEl('button', {
					text: 'Remove',
					cls: 'gamify-remove-btn'
				});
				removeButton.style.marginLeft = '10px';				
				removeButton.addEventListener('click', async () => {
					this.plugin.settings.trackedNotes = this.plugin.settings.trackedNotes.filter(p => p !== path);
					await this.plugin.saveSettings();
					this.display();
				});
			});
		}
		
		containerEl.createEl('h2', {text: 'XP/Point Modifier'});
        if (!this.hasSystemControlAccess()) {
            const notice = containerEl.createEl('div', {
                cls: 'setting-item-description',
                text: 'You do not have permission to modify this settings.'
            });
            notice.style.color = 'var(--text-error)';
            notice.style.marginBottom = '1em';
        }		
		new Setting(containerEl)
			.setName('XP per character')
			.setDesc('How much XP is earned for each character typed.')
			.addText(text => {
                text.setValue(this.plugin.settings.xpPerCharacter.toString());
                
                if (!this.hasSystemControlAccess()) {
                    text.setDisabled(true);
                    text.inputEl.title = "Permission Required.";
                } else {
                    text.onChange(async (value) => {
                        this.plugin.settings.xpPerCharacter = parseFloat(value) || 0.1;
                        await this.plugin.saveSettings();
                    });
                }
            });
		
		new Setting(containerEl)
			.setName('Base points value')
			.setDesc('Base points awarded for completing a task.')
			.addText(text => {
                text.setValue(this.plugin.settings.pointsBaseValue.toString());
                
                if (!this.hasSystemControlAccess()) {
                    text.setDisabled(true);
                    text.inputEl.title = "Permission Required.";
                } else {
                    text.onChange(async (value) => {
                        this.plugin.settings.pointsBaseValue = parseInt(value) || 10;
                        await this.plugin.saveSettings();
                    });
                }
            });
				
		containerEl.createEl('h2', {text: 'Tag Multipliers'});
        if (!this.hasSystemControlAccess()) {
            const notice = containerEl.createEl('div', {
                cls: 'setting-item-description',
                text: 'You do not have permission to modify this settings.'
            });
            notice.style.color = 'var(--text-error)';
            notice.style.marginBottom = '1em';
        }		
		Object.entries(this.plugin.settings.tagMultipliers).forEach(([tag, multiplier]) => {
			const setting = new Setting(containerEl)
				.setName(`Multiplier for ${tag}`)
				.setDesc(`Multiplier for tasks with the ${tag} tag.`)
				.addText(text => {
                    text.setValue(multiplier.toString());
                    
                    if (!this.hasSystemControlAccess()) {
                        text.setDisabled(true);
                        text.inputEl.title = "Permission Required.";
                    } else {
                        text.onChange(async (value) => {
                            this.plugin.settings.tagMultipliers[tag] = parseFloat(value) || 1.0;
                            await this.plugin.saveSettings();
                        });
                    }
                });
                
            if (this.hasSystemControlAccess()) {
                setting.addButton(button => button
                    .setButtonText('Remove')
                    .onClick(async () => {
                        delete this.plugin.settings.tagMultipliers[tag];
                        await this.plugin.saveSettings();
                        this.display();
                    }));
            }
		});
		
        if (this.hasSystemControlAccess()) {
            const newTagSetting = new Setting(containerEl)
                .setName('Add new tag multiplier')
                .setDesc('Add a new tag and its point multiplier.');
            
            let newTagInput: HTMLInputElement | null = null;
            let newMultiplierInput: HTMLInputElement | null = null;
            
            newTagSetting.addText(text => {
                text.setPlaceholder('#tag');
                text.setValue('');
                newTagInput = text.inputEl;
            });
            
            newTagSetting.addText(text => {
                text.setPlaceholder('multiplier');
                text.setValue('1.0');
                newMultiplierInput = text.inputEl;
            });
            
            newTagSetting.addButton(button => button
                .setButtonText('Add')
                .onClick(async () => {
                    if (newTagInput && newMultiplierInput) {
                        const tag = newTagInput.value;
                        const multiplier = parseFloat(newMultiplierInput.value) || 1.0;
                        
                        if (tag && tag.startsWith('#')) {
                            this.plugin.settings.tagMultipliers[tag] = multiplier;
                            await this.plugin.saveSettings();
                            this.display();
                        }
                    }
                }));
        }

		containerEl.createEl('h2', {text: 'Task Assessment'});

		new Setting(containerEl)
			.setName('Scan Completed Tasks')
			.setDesc('Find and assess all completed tasks that have not been logged.')
			.addButton(button => button
				.setButtonText('Scan Completed')
				.onClick(async () => {
					await this.plugin.taskAssessmentService.assessCompletedTasks();
				}));

		new Setting(containerEl)
			.setName("Scan Interval (minutes)")
			.setDesc("Set how often progress is saved and completed tasks are scanned.")
			.addDropdown(dropdown => {
				["1", "5", "10", "15", "30", "60"].forEach(value => {
					dropdown.addOption(value, `${value} minutes`);
				});

				dropdown.setValue(this.plugin.settings.scanInterval.toString());
				dropdown.onChange(async (value) => {
					this.plugin.settings.scanInterval = parseInt(value);
					await this.plugin.saveSettings();
					this.plugin.startPeriodicScanning(); 
				});
			});

		new Setting(containerEl)
			.setName('Deduct Points for Unchecking Tasks')
			.setDesc('When a completed task is unchecked, deduct the awarded points.')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.deductPointsForUnchecking);

				if (!this.hasSystemControlAccess()) {
					toggle.setDisabled(true);
					toggle.toggleEl.title = "Permission Required.";
				} else {
					toggle.onChange(async (value) => {
						this.plugin.settings.deductPointsForUnchecking = value;
						await this.plugin.saveSettings();
					});
				}
			});
	

		containerEl.createEl('h2', {text: 'Rate Limiting'});

		new Setting(containerEl)
			.setName('Enable Rate Limiting')
			.setDesc('Limit the rate of requests to the LLM API to avoid issues.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.rateLimiting.enabled)
				.onChange(async (value) => {
					this.plugin.settings.rateLimiting.enabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Requests Per Minute')
			.setDesc('Maximum number of requests to send per minute (1-60).')
			.addSlider(slider => slider
				.setLimits(1, 60, 1)
				.setValue(this.plugin.settings.rateLimiting.requestsPerMinute)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.rateLimiting.requestsPerMinute = value;
					await this.plugin.saveSettings();
				}));
				
		containerEl.createEl('h2', {text: 'LLM API'});
			
		new Setting(containerEl)
			.setName('API URL')
			.setDesc('URL of your local LLM API.')
			.addText(text => text
				.setValue(this.plugin.settings.apiUrl)
				.onChange(async (value) => {
					this.plugin.settings.apiUrl = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('API Key')
			.setDesc('API key for authentication (if required).')
			.addText(text => text
				.setValue(this.plugin.settings.apiKey)
				.setPlaceholder('your-api-key')
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));
				
        new Setting(containerEl)
            .setName('Test Connection')
            .setDesc('Test the connection to your LLM API.')
            .addButton(button => button
                .setButtonText('Test Connection')
                .onClick(async () => {
                    const connectionTest = await this.plugin.testConnection();
                    
                    if (connectionTest) {
                        new Notice('Connection successful!');
                        
                        const models = await this.plugin.fetchAvailableModels();
                        this.plugin.availableModels = models;
                        
                        this.updateModelDropdown();
                    } else {
                        new Notice('Connection failed. Please check your API URL and key.');
                    }
                }));
        
        const modelSetting = new Setting(containerEl)
            .setName('LLM Model')
            .setDesc('Select which LLM model to use for task assessment.');
            
        this.modelDropdown = document.createElement('select');
        this.modelDropdown.classList.add('dropdown');
        this.modelDropdown.value = this.plugin.settings.selectedLLMModel;
        this.modelDropdown.addEventListener('change', async () => {
            this.plugin.settings.selectedLLMModel = this.modelDropdown.value;
            await this.plugin.saveSettings();
        });
        
        const defaultOption = document.createElement('option');
        defaultOption.value = this.plugin.settings.selectedLLMModel;
        defaultOption.text = this.plugin.settings.selectedLLMModel;
        this.modelDropdown.appendChild(defaultOption);
        
        try {
            const models = await this.plugin.fetchAvailableModels();
            if (models && models.length > 0) {
                this.plugin.availableModels = models;
                this.updateModelDropdown();
            }
        } catch (error) {
            console.error("Error loading models:", error);
        }
        
        modelSetting.controlEl.appendChild(this.modelDropdown);
        		
		containerEl.createEl('h2', {text: 'Progress'});
		
		if (this.plugin.statCardData) {
			const progressDiv = containerEl.createDiv();
			progressDiv.innerHTML = `
				<div style="padding: 15px; border: 2px solid var(--background-modifier-border); border-radius: 8px; margin-bottom: 15px; background: var(--background-secondary); box-shadow: 0px 0px 8px rgba(0, 0, 0, 0.1); font-family: 'Montserrat', sans-serif; color: var(--text-normal);">
					
					<!-- Core Stats Section with User Favicon -->
					<div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--background-modifier-hover); border-radius: 6px;">
						<div style="display: flex; flex-direction: column;">
							<p><strong>Level:</strong> ${this.plugin.statCardData.level || 1}</p>
							<p><strong>XP:</strong> ${Math.floor(this.plugin.statCardData.xp || 0)} / ${this.plugin.statCardData.nextLevelXp || 100}</p>
							<p><strong>Points:</strong> ${this.plugin.statCardData.points || 0}</p>
						</div>
						<div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; background: var(--background-modifier-border); display: flex; align-items: center; justify-content: center;">
							<div style="width: 50px; height: 50px; border-radius: 50%; background: var(--background-modifier-border); display: flex; align-items: center; justify-content: center;">
							</div>
						</div>
					</div>

					<!-- Skills Section (Collapsible) -->
					<details style="margin-top: 10px;">
						<summary style="font-weight: bold; cursor: pointer;">Skills</summary>
						<ul style="padding-left: 15px; list-style: none;">
							${this.plugin.statCardData.skills.map(skill => `
								<li style="background: var(--background-modifier-hover); padding: 6px; margin: 3px 0; border-radius: 4px; border: 1px solid var(--background-modifier-border);"> <strong>${skill.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong> (Level ${skill.level} - XP: ${skill.xp})</li>
							`).join('')}
						</ul>
					</details>

					<!-- Grouped Stats Section -->
					<div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; margin-top: 10px;">
						<div style="flex: 1; min-width: 140px; background: var(--background-modifier-hover); padding: 8px; border-radius: 6px;">
							<p><strong>Tasks Completed:</strong> ${this.plugin.statCardData?.stats?.tasksCompleted || 0}</p>
							<p><strong>Total Points Earned:</strong> ${this.plugin.statCardData.stats?.totalPointsEarned || 0}</p>
						</div>
						<div style="flex: 1; min-width: 140px; background: var(--background-modifier-hover); padding: 8px; border-radius: 6px;">
							<p><strong>Highest Difficulty:</strong> ${this.plugin.statCardData.stats?.highestDifficulty || 0}</p>
							<p><strong>File/Folder Counts:</strong> ${this.plugin.statCardData.stats?.lastFileCount || 0} / ${this.plugin.statCardData.stats?.lastFolderCount || 0}</p>
						</div>
					</div>

					<!-- Owned Items and Titles Section -->
					<div style="margin-top: 10px; background: var(--background-modifier-hover); padding: 8px; border-radius: 6px;">
						<strong>Owned Items:</strong> 
						${this.plugin.statCardData.items.length ? this.plugin.statCardData.items.map(oitem => `
							<span 
								class="oitem-tooltip" 
								item="${oitem.description}\nUnlocked At: ${new Date(oitem.unlockedAt).toLocaleString()}"
							>
								${oitem.name}
							</span>
						`).join(', ') : 'None'}
					</p>
					<style>
						.oitem-tooltip {
							text-decoration: bold;
							cursor: help;
							position: relative;
						}
					</style>						
					<p>
						<strong>Titles:</strong> 
						${this.plugin.statCardData.titles.length ? this.plugin.statCardData.titles.map(title => `
							<span 
								class="title-tooltip" 
								title="${title.description}\nEffects: ${title.effect.join(", ")}\nUnlocked At: ${new Date(title.unlockedAt).toLocaleString()}"
							>
								${title.name}
							</span>
						 `).join(', ') : 'None'}
					</p>

					<style>
						.title-tooltip {
							text-decoration: underline;
							cursor: help;
							position: relative;
						}
					</style>
					</div>

					<!-- Active Theme and Effects Section (Collapsible) -->
					<details style="margin-top: 10px;">
						<summary style="font-weight: bold; cursor: pointer;">Active Theme & Effects</summary>
						<div style="background: var(--background-modifier-hover); padding: 8px; border-radius: 6px; margin-top: 5px;">
							<p><strong>Active Theme:</strong> ${this.plugin.statCardData.activeTheme ? this.plugin.statCardData.activeTheme.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'None'}</p>
							<p><strong>Active Effects:</strong> ${this.plugin.statCardData.activeEffects?.xpMultiplier ? 
								`XP Multiplier: ${this.plugin.statCardData.activeEffects.xpMultiplier.value} (Expires: ${new Date(this.plugin.statCardData.activeEffects.xpMultiplier.expiresAt).toLocaleString()})` : 'None'}</p>
						</div>
					</details>
				</div>
			`;


		} else {
			containerEl.createEl('p', {
				text: 'Progress data not available. Please initialize the plugin first.'
			});
		}

		containerEl.createEl('h2', { text: 'Achievements' });

		const allAchievements = [...this.plugin.defaultAchievements, ...this.plugin.customAchievements];

		allAchievements.forEach(achievement => {
			const isUnlocked = this.plugin.statCardData.achievements.some(a => a.id === achievement.id);

			const achievementDiv = containerEl.createDiv("achievement-item");
			achievementDiv.createEl("strong", { text: achievement.name });
			achievementDiv.createEl("p", { text: achievement.description });

			if (isUnlocked) {
				achievementDiv.addClass("unlocked");
			} else {
				achievementDiv.addClass("locked");
			}
		});

		containerEl.createEl('h2', { text: 'Task Streaks' });

		const currentStreakEl = containerEl.createEl("p", { 
			text: `Current Streak: ${this.plugin.statCardData.streaks.currentStreak} days`,
			cls: "gamify-streak-text"
		});

		const longestStreakEl = containerEl.createEl("p", { 
			text: `Longest Streak: ${this.plugin.statCardData.streaks.longestStreak} days`,
			cls: "gamify-streak-text"
		});

		new Setting(containerEl)
			.setName('Enable Inventory Tab')
			.setDesc('Display the inventory tab (requires the Infinite Inventory item)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableInventoryTab)
				.onChange(async (value) => {
					this.plugin.settings.enableInventoryTab = value;
					await this.plugin.saveSettings();
			  
					if (value && this.plugin.hasInfiniteInventory()) {
						this.plugin.activateInventoryTab();
					} else {
						this.app.workspace.detachLeavesOfType("inventory-view");
					}
				}));
				
		new Setting(containerEl)
			.setName('Reset Completed Tasks')
			.setDesc('Clear the list of completed tasks.')
			.addButton(button => {
                button.setButtonText('Reset Task Completion Count')
                      .setWarning();
                if (!this.hasSystemControlAccess()) {
                    button.setDisabled(true);
                    button.buttonEl.title = "Permission Required.";
                } else {
                    button.onClick(async () => {
                        if (this.plugin.statCardData && this.plugin.statCardData.stats) {
                            const confirm = await new Promise(resolve => {
                                const modal = new ConfirmationModal(this.app, 
                                    "Reset Completed Tasks", 
                                    "Are you sure you want to reset completed tasks? This cannot be undone!", 
                                    resolve);
                                modal.open();
                            });
                        
                            if (confirm) {					
                                this.plugin.statCardData.stats.tasksCompleted = 0;
                                await this.plugin.saveStatCardData();
                                this.display();
                                new Notice('Task completion history has been reset.');
								this.plugin.statCardService.refreshUI();

                            }
                        } else {
                            new Notice('Stats data not available.');
                        }
                    });
                }
            });		

		
		new Setting(containerEl)
			.setName('Reset Progress')
			.setDesc('Warning: This will reset all your progress!')
			.addButton(button => button
				.setButtonText('Reset All Progress')
				.setWarning()
				.onClick(async () => {
					const confirm = await new Promise(resolve => {
						const modal = new ConfirmationModal(this.app, 
							"Reset Progress", 
							"Are you sure you want to reset all progress? This cannot be undone!", 
							resolve);
						modal.open();
					});
					
					if (confirm) {
						this.plugin.initializeDefaultStatCardData();
						await this.plugin.saveStatCardData();
						
						this.display();
						new Notice('All progress has been reset.');
						this.plugin.statCardService.refreshUI();

					}
				}));
		    containerEl.createEl('h2', {text: 'Debug Settings'});
    
		new Setting(containerEl)
			.setName('Enable Debug Mode')
			.setDesc('Enables debug features when you have the "debugger" title.')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.debugMode);
				
				if (!this.hasSystemControlAccess()) {
					toggle.setDisabled(true);
					toggle.toggleEl.title = "Permission Required.";
				} else {
					toggle.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.plugin.saveSettings();
					});
				}
			});
			
		if (this.plugin.settings.debugMode) {
			const debugDesc = containerEl.createEl('div', {
				cls: 'setting-item-description',
				text: 'Debug mode is enabled. Acquire the "debugger" title to access debug menu via ribbon icon or command palette.'
			});
			
			if (this.plugin.hasDebugPermission()) {
				const openDebugBtn = containerEl.createEl('button', {
					text: 'Open Debug Menu',
					cls: 'mod-cta'
				});
				openDebugBtn.style.marginTop = '10px';
				openDebugBtn.addEventListener('click', () => {
					new DebugMenu(this.app, this.plugin).open();
				});
			} else {
				const warningDiv = containerEl.createEl('div', {
					cls: 'setting-item-description',
					text: 'You need the "debugger" title to access debug features.'
				});
				warningDiv.style.color = 'var(--text-error)';
			}
		}	
	}
	

    updateModelDropdown() {
        if (!this.modelDropdown) return;
        
        while (this.modelDropdown.firstChild) {
            this.modelDropdown.removeChild(this.modelDropdown.firstChild);
        }
        
        if (this.plugin.availableModels && this.plugin.availableModels.length > 0) {
            this.plugin.availableModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.text = model.id;
                
                if (model.id === this.plugin.settings.selectedLLMModel) {
                    option.selected = true;
                }
                
                this.modelDropdown.appendChild(option);
            });
            
            if (!this.plugin.availableModels.some(m => m.id === this.plugin.settings.selectedLLMModel)) {
                const option = document.createElement('option');
                option.value = this.plugin.settings.selectedLLMModel;
                option.text = this.plugin.settings.selectedLLMModel + " (not found)";
                option.selected = true;
                this.modelDropdown.appendChild(option);
            }
        } else {
            const option = document.createElement('option');
            option.value = this.plugin.settings.selectedLLMModel;
            option.text = this.plugin.settings.selectedLLMModel;
            this.modelDropdown.appendChild(option);
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

class ConfirmationModal extends Modal {
	result: (value: boolean) => void;
	message: string;
	
	constructor(app: App, title: string, message: string, result: (value: boolean) => void) {
		super(app);
		this.result = result;
		this.message = message;
	}
	
	onOpen() {
		const {contentEl} = this;
		
		contentEl.createEl("h2", {text: "Confirmation"});
		contentEl.createEl("p", {text: this.message});
		
		const buttonContainer = contentEl.createDiv();
		buttonContainer.addClass("modal-button-container");
		
		const cancelButton = buttonContainer.createEl("button", {text: "Cancel"});
		cancelButton.addEventListener("click", () => {
			this.result(false);
			this.close();
		});
		
		const confirmButton = buttonContainer.createEl("button", {text: "Confirm"});
		confirmButton.addClass("mod-warning");
		confirmButton.addEventListener("click", () => {
			this.result(true);
			this.close();
		});
	}
	
	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class DebugMenu extends Modal {
    plugin: GamifyPlugin;

    constructor(app: App, plugin: GamifyPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: "Debug Menu" });

        this.createStatsSection(contentEl);
        this.createSkillsSection(contentEl);
        this.createItemsSection(contentEl);
        this.createStatsManipulationSection(contentEl);
        this.createTitlesSection(contentEl);
        this.createDebugTools(contentEl);

        const saveBtn = contentEl.createEl("button", { 
            text: "Save All Changes", 
            cls: "mod-cta debug-button"
        });
        saveBtn.style.marginTop = "20px";
        saveBtn.addEventListener("click", async () => {
            await this.plugin.saveStatCardData();
            new Notice("Debug changes saved successfully!");
            this.close();
        });
    }

    createStatsSection(parent: HTMLElement) {
        const section = parent.createDiv("debug-section");
        section.createEl("h3", { text: "Core Stats" });

        this.createStatControl(section, "XP", () => this.plugin.statCardData.xp, (val) => { 
            this.plugin.statCardData.xp = val; 
            this.plugin.checkForLevelUp();
        });

        this.createStatControl(section, "Level", () => this.plugin.statCardData.level, (val) => { 
            this.plugin.statCardData.level = val; 
            this.plugin.statCardData.nextLevelXp = Math.round(100 * Math.pow(1.1 + val * 0.05, val - 1));
        });

        this.createStatControl(section, "Points", () => this.plugin.statCardData.points, (val) => {
            this.plugin.statCardData.points = val;
        });
    }

    createSkillsSection(parent: HTMLElement) {
        const section = parent.createDiv("debug-section");
        section.createEl("h3", { text: "Skills" });

        const skillSelector = section.createEl("select");
        this.plugin.statCardData.skills.forEach(skill => {
            const option = skillSelector.createEl("option");
            option.value = skill.id;
            option.text = skill.name;
        });

        const selectedSkillDiv = section.createDiv("selected-skill-controls");

        const updateSelectedSkillControls = () => {
            const selectedSkillId = skillSelector.value;
            const selectedSkill = this.plugin.statCardData.skills.find(s => s.id === selectedSkillId);
            if (!selectedSkill) return;

            selectedSkillDiv.empty();
            this.createStatControl(selectedSkillDiv, "Skill Level", () => selectedSkill.level, (val) => selectedSkill.level = val);
            this.createStatControl(selectedSkillDiv, "Skill XP", () => selectedSkill.xp, (val) => selectedSkill.xp = val);
        };

        skillSelector.addEventListener("change", updateSelectedSkillControls);
        updateSelectedSkillControls();
    }

    createItemsSection(parent: HTMLElement) {
        const section = parent.createDiv("debug-section");
        section.createEl("h3", { text: "Owned Items" });

        const itemInputContainer = section.createDiv("item-input-container");
        const itemInput = itemInputContainer.createEl("input", {
            type: "text",
            placeholder: "Enter item id to add"
        });

        const addItemButton = itemInputContainer.createEl("button", { text: "Add Item", cls: "debug-button" });
        addItemButton.addEventListener("click", () => {
            const itemId = itemInput.value.trim();
            if (itemId && !this.plugin.statCardData.ownedItems.includes(itemId)) {
                this.plugin.statCardData.ownedItems.push(itemId);
                this.renderOwnedItems(itemsListDiv);
                itemInput.value = '';
            }
        });

        const itemsListDiv = section.createDiv("items-list");
        this.renderOwnedItems(itemsListDiv);
    }

    createStatsManipulationSection(parent: HTMLElement) {
        const section = parent.createDiv("debug-section");
        section.createEl("h3", { text: "Stats & Counters" });

        this.createStatControl(section, "Tasks Completed", () => this.plugin.statCardData.stats.tasksCompleted, (val) => this.plugin.statCardData.stats.tasksCompleted = val);
        this.createStatControl(section, "Total Points Earned", () => this.plugin.statCardData.stats.totalPointsEarned, (val) => this.plugin.statCardData.stats.totalPointsEarned = val);
    }

	createTitlesSection(parent: HTMLElement) {
		const section = parent.createDiv("debug-section");
		section.createEl("h3", { text: "Manage Titles" });

		const titleIdInput = section.createEl("input", { type: "text", placeholder: "Enter Title ID" });
		const titleNameInput = section.createEl("input", { type: "text", placeholder: "Enter Title Name" });
		const titleDescInput = section.createEl("input", { type: "text", placeholder: "Enter Title Description" });

		const addTitleButton = section.createEl("button", { text: "Add Title", cls: "debug-button" });

		addTitleButton.addEventListener("click", () => {
			const id = titleIdInput.value.trim();
			const name = titleNameInput.value.trim();
			const description = titleDescInput.value.trim();

			if (!id || !name || !description) {
				new Notice("Please fill in all fields before adding a title.");
				return;
			}

			if (this.plugin.statCardData.titles.some(title => title.id === id)) {
				new Notice(`Title "${name}" already exists.`);
				return;
			}

			const newTitle = {
				id,
				name,
				description,
				unlockedAt: new Date().toISOString(),
				effect: []
			};

			this.plugin.statCardData.titles.push(newTitle);

			this.renderTitlesList(titlesListDiv);
			titleIdInput.value = "";
			titleNameInput.value = "";
			titleDescInput.value = "";
		});

		const titlesListDiv = section.createDiv("titles-list");
		this.renderTitlesList(titlesListDiv);
	}


    createDebugTools(parent: HTMLElement) {
        const section = parent.createDiv("debug-section");
        section.createEl("h3", { text: "Debug Tools" });

        const forceSaveBtn = section.createEl("button", { text: "Force Save Data", cls: "debug-button" });
        forceSaveBtn.addEventListener("click", async () => {
            await this.plugin.saveStatCardData();
            new Notice("Data force-saved successfully");
        });
    }

	createStatControl(containerEl: HTMLElement, label: string, getValue: () => number, setValue: (val: number) => void) {
		const controlDiv = containerEl.createDiv("stat-control");

		const labelEl = controlDiv.createEl("span", { text: label, cls: "stat-label" });

		const buttonContainer = controlDiv.createDiv("stat-button-container");

		const buttons = [
			{ text: "-10", change: -10, cls: "decrease-button" },
			{ text: "-1", change: -1, cls: "decrease-button" },
			{ text: "+1", change: 1, cls: "increase-button" },
			{ text: "+10", change: 10, cls: "increase-button" }
		];

		const leftButtonGroup = buttonContainer.createDiv("stat-button-group");
		buttons.slice(0, 2).forEach(({ text, change, cls }) => {
			const btn = leftButtonGroup.createEl("button", { text, cls: `debug-button ${cls}` });
			btn.addEventListener("click", () => {
				const newVal = Math.max(0, getValue() + change);
				setValue(newVal);
				valueSpan.textContent = `${newVal}`;
			});
		});

		const valueSpan = buttonContainer.createEl("span", { text: `${getValue()}`, cls: "stat-value" });

		const rightButtonGroup = buttonContainer.createDiv("stat-button-group");
		buttons.slice(2).forEach(({ text, change, cls }) => {
			const btn = rightButtonGroup.createEl("button", { text, cls: `debug-button ${cls}` });
			btn.addEventListener("click", () => {
				const newVal = Math.max(0, getValue() + change);
				setValue(newVal);
				valueSpan.textContent = `${newVal}`;
			});
		});
	}


    renderOwnedItems(containerEl: HTMLElement) {
        containerEl.empty();
        this.plugin.statCardData.ownedItems.forEach(itemId => {
            const div = containerEl.createDiv("owned-item");
            div.createEl("span", { text: itemId });

            const removeBtn = div.createEl("button", { text: "Remove", cls: "debug-button" });
            removeBtn.addEventListener("click", () => {
				this.plugin.statCardData.ownedItems = this.plugin.statCardData.ownedItems.filter(id => id !== itemId);
                this.renderOwnedItems(containerEl);
            });
        });
    }

	renderTitlesList(containerEl: HTMLElement) {
		containerEl.empty();

		if (this.plugin.statCardData.titles.length === 0) {
			containerEl.createEl("p", { text: "No titles unlocked yet.", cls: "debug-empty-message" });
			return;
		}

		this.plugin.statCardData.titles.forEach(title => {
			const titleDiv = containerEl.createDiv("title-item");

			titleDiv.createEl("h4", { text: title.name });

			titleDiv.createEl("p", { text: title.description, cls: "title-description" });

			const unlockDate = new Date(title.unlockedAt).toLocaleDateString();
			titleDiv.createEl("p", { text: `Unlocked on: ${unlockDate}`, cls: "title-unlock-date" });

			if (title.effect.length > 0) {
				const effectsList = titleDiv.createEl("ul", { cls: "title-effects-list" });
				title.effect.forEach(effect => {
					effectsList.createEl("li", { text: effect });
				});
			}

			const removeBtn = titleDiv.createEl("button", { text: "Remove", cls: "debug-button" });
			removeBtn.addEventListener("click", () => {
				this.plugin.statCardData.titles = this.plugin.statCardData.titles.filter(t => t.id !== title.id);
				this.renderTitlesList(containerEl);
			});

			titleDiv.appendChild(removeBtn);
		});
	}


}
