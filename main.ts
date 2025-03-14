import { App, MarkdownView, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, EventRef, Notice, Modal, WorkspaceLeaf } from 'obsidian';
import { StatCardService, LLMTaskService } from './services';
import { TaskAssessmentService } from './task-assessment-service';
import { TaskStorageRibbonIcon } from './task-storage-viewer';
import { ItemStoreService } from './itemStore';

interface GamifyPluginSettings {
	xpPerCharacter: number;
	pointsBaseValue: number;
	tagMultipliers: Record<string, number>;
	apiUrl: string;
	apiKey: string;
	trackedNotes: string[];
	selectedLLMModel: string;
    rateLimiting: {
        enabled: boolean;
        requestsPerMinute: number;
    };	
    scanInterval: number;
    deductPointsForUnchecking: boolean;	
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
	effects: string[];
}

interface Achievement {
	id: string;
	name: string;
	description: string;
	unlockedAt: string;
}

interface Titles {
	id: string;
	name: string;
	description: string;
	unlockedAt: string;
	effects: string[];

}
interface Stats {
	tasksCompleted: number;
	totalPointsEarned: number;
	highestDifficulty: number;
    tasksUnchecked: number;
    totalPointsDeducted: number;
	itemsPurchased?: number;	
	lastFileCount: number;
	lastFolderCount: number;
}

interface ProcessedTask {
	filePath: string;
	taskText: string;
	completedOn: string;
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
	trackedNotes: [],
	selectedLLMModel: 'local-model',
    rateLimiting: {
        enabled: true,
        requestsPerMinute: 10 //minutes
    },	
	scanInterval: 5, //minutes
    deductPointsForUnchecking: true
};

export default class GamifyPlugin extends Plugin {
	settings: GamifyPluginSettings;
	statCardData: StatCardData;
    statCardService: StatCardService;
    llmTaskService: LLMTaskService;
    availableModels: LLMModel[] = [];
	itemStoreService: ItemStoreService;
	taskAssessmentService: TaskAssessmentService;
	fileChangedEventRef: EventRef;
	typing: {
		characterCount: number;
		timeout: NodeJS.Timeout | null;
	};
    
    // For rate limiting
    private requestQueue: Array<() => Promise<any>> = [];
    private processingQueue = false;
    private lastRequestTime = 0;

	private scanIntervalId: NodeJS.Timeout | null = null;
	
	private loadExternalStyles() {
		const existingStyle = document.getElementById('gamify-styles');
		if (existingStyle) {
			existingStyle.remove();
		}

		const linkEl = document.createElement('link');
		linkEl.id = 'gamify-styles';
		linkEl.rel = 'stylesheet';
		linkEl.type = 'text/css';
		linkEl.href = this.app.vault.adapter.getResourcePath(this.manifest.dir + '/styles.css');

		document.head.appendChild(linkEl);
	}

	startPeriodicScanning() {
		if (this.scanIntervalId) clearInterval(this.scanIntervalId);

		this.scanIntervalId = setInterval(() => {
			this.taskAssessmentService.assessCompletedTasks();
		}, this.settings.scanInterval * 60 * 1000);
	}

	async onload() {
		this.app.workspace.onLayoutReady(async () => {
			await this.loadSettings();
			await this.loadStatCardData();
			this.loadExternalStyles();
			// Initialize services
			this.statCardService = new StatCardService(this);
			this.llmTaskService = new LLMTaskService(this);
			this.itemStoreService = new ItemStoreService(this);
		
			this.statCardService.initializeUI();
			this.statCardService.refreshUI();
			this.taskAssessmentService = new TaskAssessmentService(this);
			this.taskAssessmentService.initializeTaskStorage();	
			this.startPeriodicScanning();
			
			// Add ribbon icons
			new TaskStorageRibbonIcon(this, this.taskAssessmentService);
			this.addRibbonIcon("check-circle", "Scan for Tasks", () => {
				this.taskAssessmentService.assessCompletedTasks();
				new Notice("Manual scan started.");
			});			
			
			// Initialize typing tracker
			this.typing = {
				characterCount: 0,
				timeout: null
			};

			// Register event for typing XP
			this.registerDomEvent(document, 'keydown', (evt: KeyboardEvent) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view && this.isContentKey(evt)) {
					this.handleTyping();
				}
			});
            
            this.fileChangedEventRef = this.app.vault.on("modify", (file: TAbstractFile) => {
                if (file instanceof TFile && this.settings.trackedNotes.includes(file.path)) {
                    this.checkForUncheckedTasks(file);
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

			this.addSettingTab(new GamifySettingTab(this.app, this));
		});		
	}

	onunload() {
		if (this.typing.timeout) {
			clearTimeout(this.typing.timeout);
			this.processTypingXp();
		}

		if (this.scanIntervalId) {
			clearInterval(this.scanIntervalId);
			this.scanIntervalId = null;
		}

		const styleEl = document.getElementById('gamify-styles');
		if (styleEl) styleEl.remove();
		
		this.app.vault.offref(this.fileChangedEventRef);
	}
    
    async checkForUncheckedTasks(file: TFile) {
        // Implementation to check for unchecked tasks and deduct points if the setting is enabled
        if (!this.settings.deductPointsForUnchecking) return;
        
        // Placeholder for implementation:
        // const fileContent = await this.app.vault.read(file);
        // ... logic to find unchecked tasks ...
        // if (uncheckedTask) {
        //    const pointsToDeduct = calculatePointsToDeduct(uncheckedTask);
        //    this.statCardData.points -= pointsToDeduct;
        //    this.statCardData.stats.tasksUnchecked++;
        //    this.statCardData.stats.totalPointsDeducted += pointsToDeduct;
        //    await this.saveStatCardData();
        //    this.statCardService.refreshUI();
        // }
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
		}, 2000); // Should probably change the inactivity time
	}

	processTypingXp() {
		const xpGained = this.typing.characterCount * this.settings.xpPerCharacter;
		this.statCardData.xp += xpGained;
		this.typing.characterCount = 0;
		this.typing.timeout = null;
		
		// Potential performance issue - revisit
		this.checkForLevelUp();
		this.saveStatCardData();
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
			}
		);
		
		modal.open();
	}
	
	extractTags(text: string): string[] {
		const tagRegex = /#[\w-]+/g;
		return (text.match(tagRegex) || []);
	}

	async calculatePointsForTask(taskText: string, tags: string[]): Promise<number> {
		// Use LLM first, fallback to basic calculation - should include some indicator in status bar - revisit
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
		// Prepare the query for the LLM - work fine - use file templates? - revisit
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
            
            // Extract the points from the response
            if (data.choices && data.choices[0] && data.choices[0].message && 
                data.choices[0].message.tool_calls && data.choices[0].message.tool_calls[0]) {
                
                const toolCall = data.choices[0].message.tool_calls[0];
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                // Update stats logic needs work - revisit
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

	checkForLevelUp() {
		while (this.statCardData.xp >= this.statCardData.nextLevelXp) {
			this.statCardData.xp -= this.statCardData.nextLevelXp;
			this.statCardData.level++;
			
			// Increase required XP for next level - find better eqn
			this.statCardData.nextLevelXp = Math.round(this.statCardData.nextLevelXp * (1.1 + this.statCardData.level * 0.05));
			
			new Notice(`Congratulations! You reached level ${this.statCardData.level}!`);
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
			const dataFile = this.app.vault.getAbstractFileByPath('VQ/data.json');
			
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
			// Initialize with default data - revisit
			this.initializeDefaultStatCardData();
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
				lastFileCount: 0,
				lastFolderCount: 0
			},
			ownedItems: [],
			activeEffects: {}			
		};
	}

	async saveStatCardData(): Promise<void> {
		try {
			const data = JSON.stringify({ 
				statCardData: this.statCardData,
			}, null, 2);
			

			const dataFile = this.app.vault.getAbstractFileByPath('VQ/data.json');
			
			if (dataFile instanceof TFile) {

				await this.app.vault.modify(dataFile, data);
			} else {

				await this.app.vault.create('VQ/data.json', data);
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
                
                // Make read-only if user doesn't have system_control
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
                
                // Make read-only if user doesn't have system_control
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
        // Add a notice if user doesn't have system control
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
                    
                    // Make read-only if user doesn't have system_control
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
                
            // Only show remove button if user has system_control
            if (this.hasSystemControlAccess()) {
                setting.addButton(button => button
                    .setButtonText('Remove')
                    .onClick(async () => {
                        delete this.plugin.settings.tagMultipliers[tag];
                        await this.plugin.saveSettings();
                        this.display(); // Reload the settings panel
                    }));
            }
		});
		
        // Only show the add new tag multiplier if user has system_control
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
                            this.display(); // Reload the settings panel
                        }
                    }
                }));
        }

		// Task Assessment Section
		containerEl.createEl('h2', {text: 'Task Assessment'});

		// Scan Completed Tasks button
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
			.setDesc("Set how often completed tasks are scanned.")
			.addDropdown(dropdown => {
				["1", "5", "10", "15", "30", "60"].forEach(value => {
					dropdown.addOption(value, `${value} minutes`);
				});

				dropdown.setValue(this.plugin.settings.scanInterval.toString());
				dropdown.onChange(async (value) => {
					this.plugin.settings.scanInterval = parseInt(value);
					await this.plugin.saveSettings();
					this.plugin.startPeriodicScanning(); // Restart with new interval
				});
			});

		// Add setting for deducting points for unchecking tasks
		new Setting(containerEl)
			.setName('Deduct Points for Unchecking Tasks')
			.setDesc('When a completed task is unchecked, deduct the awarded points.')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.deductPointsForUnchecking);

				// Make read-only if user doesn't have system_control
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
	

		// Rate Limiting Section
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
                        
                        // If connection is successful, update model list
                        const models = await this.plugin.fetchAvailableModels();
                        this.plugin.availableModels = models;
                        
                        // Update dropdown with fetched models
                        this.updateModelDropdown();
                    } else {
                        new Notice('Connection failed. Please check your API URL and key.');
                    }
                }));
        
 
        // Add model selection
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
        
        // Initial population with default model
        const defaultOption = document.createElement('option');
        defaultOption.value = this.plugin.settings.selectedLLMModel;
        defaultOption.text = this.plugin.settings.selectedLLMModel;
        this.modelDropdown.appendChild(defaultOption);
        
        // Try to fetch models when displaying settings
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
		
		// Check if statCardData exists before rendering
		if (this.plugin.statCardData) {
			const progressDiv = containerEl.createDiv();
			progressDiv.innerHTML = `
				<div style="padding: 10px; border: 1px solid var(--background-modifier-border); border-radius: 5px; margin-bottom: 20px;">
					<p><strong>Level:</strong> ${this.plugin.statCardData.level || 1}</p>
					<p><strong>XP:</strong> ${Math.floor(this.plugin.statCardData.xp || 0)} / ${this.plugin.statCardData.nextLevelXp || 100}</p>
					<p><strong>Points:</strong> ${this.plugin.statCardData.points || 0}</p>
					<p><strong>Tasks Completed:</strong> ${this.plugin.statCardData?.stats?.tasksCompleted || 0}</p>
				</div>
			`;
		} else {
			containerEl.createEl('p', {
				text: 'Progress data not available. Please initialize the plugin first.'
			});
		}

		new Setting(containerEl)
			.setName('Reset Completed Tasks')
			.setDesc('Clear the list of completed tasks.')
			.addButton(button => {
                button.setButtonText('Reset Task Completion Count')
                      .setWarning();
                
                // Only enable if user has system_control
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
					}
				}));
	}
	
    updateModelDropdown() {
        if (!this.modelDropdown) return;
        
        // Clear existing options
        while (this.modelDropdown.firstChild) {
            this.modelDropdown.removeChild(this.modelDropdown.firstChild);
        }
        
        // Add models from API
        if (this.plugin.availableModels && this.plugin.availableModels.length > 0) {
            this.plugin.availableModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.text = model.id;
                
                // Select the current model
                if (model.id === this.plugin.settings.selectedLLMModel) {
                    option.selected = true;
                }
                
                this.modelDropdown.appendChild(option);
            });
            
            // If the saved model isn't in the list, add it
            if (!this.plugin.availableModels.some(m => m.id === this.plugin.settings.selectedLLMModel)) {
                const option = document.createElement('option');
                option.value = this.plugin.settings.selectedLLMModel;
                option.text = this.plugin.settings.selectedLLMModel + " (not found)";
                option.selected = true;
                this.modelDropdown.appendChild(option);
            }
        } else {
            // Add a default option if no models are available
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