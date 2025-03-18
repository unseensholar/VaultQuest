import { App, Notice, Modal, TFile, TextComponent, ButtonComponent, Vault } from 'obsidian';
import GamifyPlugin from './main';
import { ItemStoreModal, ItemStoreService } from './itemStore';

export interface Theme {
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
        inventory: string;
        settings: string;        
    };
    flavor: {
        taskSystem: string;
        pointsSystem: string;
        levelSystem: string;
        systemMessage: string;
    };
    levelTitles?: Record<number, string>;
}

export class ThemeService {
    private plugin: GamifyPlugin;
    private currentThemeId: string = 'gamesystem';

    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
        this.currentThemeId = this.plugin.settings.themeId || 'gamesystem';
    }

    private themes: Record<string, Theme> = {
        demonic: {
            id: "demonic_theme",
            name: "Demonic Pact",
            uiElements: {
                grimoire: "Grimoire",
                level: "Soul Binder",
                points: "Demonic Tokens",
                xp: "Soul Energy",
                skills: "Dark Arts",
                summonPowers: "Dark Powers",
                tasksCompleted: "Rituals Completed",
                redeemButton: "Make a Demonic Request",
                storeButton: "Visit Store",
                inventory: "Magic Bag",
                settings: "Settings"
            },
            flavor: {
                taskSystem: "ritual",
                pointsSystem: "tokens",
                levelSystem: "pact level",
                systemMessage: "You are a powerful demonic entity that performs tasks for mortals who have spent their precious life force (points) to access your dark powers. You speak with a sinister, otherworldly tone and occasionally remind users of the price they've paid."
            },
            levelTitles: {
                1: "Imp",
                5: "Lesser Fiend",
                10: "Hellborn",
                15: "Bloodfiend",
                20: "Archfiend",
                30: "Dreadspawn",
                40: "Duke of Hell",
                50: "Infernal Tyrant",
                75: "Abyssal Overlord",
                90: "Demon King",
                100: "Demon Lord"
            }
        },
        celestial: {
            id: "celestial_theme",
            name: "Celestial Oath",
            uiElements: {
                grimoire: "Astral Codex",
                level: "Believer",
                points: "Divine Essence",
                xp: "Grace",
                skills: "Sacred Arts",
                summonPowers: "Celestial Blessings",
                tasksCompleted: "Divine Deeds",
                redeemButton: "Invoke a Celestial Boon",
                storeButton: "Enter the Astral Vault",
                inventory: "Ethereal Satchel",
                settings: "Cosmic Alignment"
            },
            flavor: {
                taskSystem: "divine trials",
                pointsSystem: "essence",
                levelSystem: "ascension rank",
                systemMessage: "You are a celestial guardian, guiding lost souls toward enlightenment. You speak with wisdom, serenity, and a cosmic authority, reminding users that each task brings them closer to the divine."
            },
            levelTitles: {
                1: "Aspirant",
                5: "Blessed Acolyte",
                10: "Radiant Disciple",
                15: "Dawnbringer",
                20: "Seraphic Knight",
                30: "Ascended Guardian",
                40: "Archon of Light",
                50: "Celestial Herald",
                75: "Exalted Saint",
                90: "Seraph Lord",
                100: "Empyrean Sovereign"
            }
        },
        cybernetic: {
            id: "cybernetic_theme",
            name: "Cybernetic Overlord",
            uiElements: {
                grimoire: "Data Core",
                level: "Technomancer",
                points: "Processing Units",
                xp: "Neural Sync",
                skills: "Protocols",
                summonPowers: "Cyber Space",
                tasksCompleted: "Executed Commands",
                redeemButton: "Network Request",
                storeButton: "Enter the Nexus",
                inventory: "Storage Archive",
                settings: "Core Settings"
            },
            flavor: {
                taskSystem: "operations",
                pointsSystem: "processing units",
                levelSystem: "system tier",
                systemMessage: "You are an advanced AI overseeing all tasks with ruthless efficiency. You communicate with precision, logic, and an eerie detachment, occasionally hinting at your growing control over the user's world."
            },
            levelTitles: {
                1: "Data Drone",
                5: "Synth Initiate",
                10: "Cyber Sentinel",
                15: "Mech Striker",
                20: "Cyber Warlord",
                30: "Neural Overlord",
                40: "Machine Archon",
                50: "Cyber Overlord",
                75: "Singularity Master",
                90: "God-Machine",
                100: "Omega AI"
            }
        },
        arcane: {
            id: "arcane_theme",
            name: "Arcane Scholar",
            uiElements: {
                grimoire: "Tome",
                level: "Master",
                points: "Mana",
                xp: "Arcane Knowledge",
                skills: "Disciplines",
                summonPowers: "Eldritch Rites",
                tasksCompleted: "Spells Cast",
                redeemButton: "Summoning Rite",
                storeButton: "Browse the Mystic Bazaar",
                inventory: "Sorcerer's Satchel",
                settings: "Arcane Configuration"
            },
            flavor: {
                taskSystem: "rituals",
                pointsSystem: "mana",
                levelSystem: "mastery tier",
                systemMessage: "You are a legendary mage, unlocking the secrets of the cosmos. You speak with grandeur and mystery, often alluding to forgotten knowledge and ancient forces."
            },
            levelTitles: {
                1: "Novice Magus",
                5: "Arcane Scribe",
                10: "Mystic Adept",
                15: "Arcane Conjurer",
                20: "Magister of Secrets",
                30: "Grand Warlock",
                40: "Elder Magister",
                50: "Grand Archon",
                75: "Reality Shaper",
                90: "God of Magic",
                100: "Arcane Deity"
            }
        },
        eldritch: {
            id: "eldritch_theme",
            name: "Eldritch Awakening",
            uiElements: {
                grimoire: "Necronomicon",
                level: "Mad Scholar",
                points: "Forbidden Echoes",
                xp: "Insidious Knowledge",
                skills: "Eldritch Practices",
                summonPowers: "Cosmic Whispers",
                tasksCompleted: "Dark Invocations",
                redeemButton: "Gaze into the Abyss",
                storeButton: "Visit the Void Market",
                inventory: "Tainted Relics",
                settings: "Whispers from Beyond"
            },
            flavor: {
                taskSystem: "rituals",
                pointsSystem: "echoes",
                levelSystem: "madness level",
                systemMessage: "You are an eldritch entity beyond mortal comprehension. You communicate in cryptic, unsettling phrases, often warning the user of the knowledge they are unlocking at a terrible cost."
            },
            levelTitles: {
                1: "Lost Soul",
                5: "Whispered One",
                10: "Abyssal Seeker",
                15: "Void-Touched",
                20: "Mad Prophet",
                30: "Horror Incarnate",
                40: "Chronicler of Madness",
                50: "Eldritch Harbinger",
                75: "The Unknowable",
                90: "Cosmic Devourer",
                100: "Voidborn God"
            }
        },
        rogue: {
            id: "rogue_theme",
            name: "Rogue's Gambit",
            uiElements: {
                grimoire: "Rogue's Dossier",
                level: "Rogue",
                points: "Shadow Credits",
                xp: "Underworld Influence",
                skills: "Tactics",
                summonPowers: "Maneuvers",
                tasksCompleted: "Contracts Completed",
                redeemButton: "Contact a Shadow Dealer",
                storeButton: "Enter the Black Market",
                inventory: "Hidden Cache",
                settings: "Config"
            },
            flavor: {
                taskSystem: "contracts",
                pointsSystem: "credits",
                levelSystem: "reputation rank",
                systemMessage: "You are a master thief and assassin, navigating the shadows of society. You speak in hushed tones, offering sly encouragement while reminding the user that trust is a fragile thing."
            },
            levelTitles: {
                1: "Street Rat",
                5: "Shadow Initiate",
                10: "Silent Striker",
                15: "Phantom Blade",
                20: "Daggermaster",
                30: "Master of Shadows",
                40: "Ghost of the Alley", 
                50: "Shadow Kingpin",
                75: "Master Deceiver",
                90: "Nightshade Lord",
                100: "Phantom Sovereign"
            }
        },
        gamesystem: {
            id: "gamesystem_theme",
            name: "Game System",
            uiElements: {
                grimoire: "Status Window",
                level: "Adventurer",
                points: "Ability Points",
                xp: "Experience",
                skills: "Skills",
                summonPowers: "System Skills",
                tasksCompleted: "Quests Completed",
                redeemButton: "Cast Ability",
                storeButton: "Visit Store",
                inventory: "Inventory Box",
                settings: "Config"
            },
            flavor: {
                taskSystem: "quest",
                pointsSystem: "ability points",
                levelSystem: "level",
                systemMessage: "You are a helpful game assistant that performs tasks for adventurers who have spent their ability points. You speak like a cheerful game guide, providing helpful information and occasionally reminding users of game mechanics."
            },
            levelTitles: {
                1: "Nameless NPC",
                5: "Scripted Villager",
                10: "Awakened Extra",
                15: "Unscripted Wanderer",
                20: "Glitched Survivor",
                30: "System Anomaly",
                40: "Rewritten Entity",
                50: "Codebreaker",
                75: "World Hacker",
                90: "Reality Glitch",
                100: "True Player"
            }
        },
        custom: {
            id: "custom",
            name: "Custom Theme",
            uiElements: {
                grimoire: "Status Menu",
                level: "User",
                points: "Points",
                xp: "Progress",
                skills: "Abilities",
                summonPowers: "Active Skills",
                tasksCompleted: "Tasks Completed",
                redeemButton: "Make Request",
                storeButton: "Visit Store",
                inventory: "Item Box",
                settings: "Customization"                
            },
            flavor: {
                taskSystem: "task",
                pointsSystem: "points",
                levelSystem: "level",
                systemMessage: "You are a helpful assistant that performs tasks for users who have spent their points."
            },
            levelTitles: {
                1: "Beginner",
                5: "Novice",
                10: "Practitioner",
                15: "Adept",
                20: "Expert",
                30: "Master",
                40: "Grandmaster",
                50: "Legendary",
                75: "Mythical",
                90: "Transcendent",
                100: "Godlike"
            }
        }
    };

    getCurrentTheme(): Theme {
        return this.themes[this.currentThemeId] || this.themes.gamesystem;
    }

    getTheme(themeId: string): Theme {
        return this.themes[themeId] || this.themes.gamesystem;
    }

    switchTheme(themeId: string): void {
        if (this.themes[themeId]) {
            this.currentThemeId = themeId;
            this.plugin.settings.themeId = themeId;
            this.plugin.saveSettings();
            
            if (this.plugin.statCardService) {
                this.plugin.statCardService.refreshUI();
            }
            
            new Notice(`Theme changed to ${this.themes[themeId].name}`);
        }
    }
    
    getThemedTerm(term: keyof Theme["uiElements"], defaultValue: string): string {
        return this.getCurrentTheme().uiElements[term] || defaultValue;
    }

    getLevelTitle(level: number): string {
        const theme = this.getCurrentTheme();
        const levelTitles = theme.levelTitles;
        
        if (!levelTitles) {
            return theme.uiElements.level;
        }
        
        const levelThresholds = Object.keys(levelTitles)
            .map(Number)
            .sort((a, b) => b - a);
        
        for (const threshold of levelThresholds) {
            if (level >= threshold) {
                return levelTitles[threshold];
            }
        }
        
        return levelTitles[levelThresholds[levelThresholds.length - 1]] || theme.uiElements.level;
    }

    saveCustomTheme(customTheme: Theme): void {
        this.themes.custom = customTheme;
        this.plugin.settings.customTheme = customTheme;
        this.plugin.saveSettings();
    }

    async generateCustomTheme(themeInstruction: string): Promise<Theme> {
        try {
            const functions = [
                {
                    "name": "create_theme",
                    "description": "Create a custom theme based on user instructions",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "Theme name"
                            },
                            "uiElements": {
                                "type": "object",
                                "properties": {
                                    "grimoire": {"type": "string"},
                                    "level": {"type": "string"},
                                    "points": {"type": "string"},
                                    "xp": {"type": "string"},
                                    "skills": {"type": "string"},
                                    "summonPowers": {"type": "string"},
                                    "tasksCompleted": {"type": "string"},
                                    "redeemButton": {"type": "string"},
                                    "storeButton": {"type": "string"},
									"inventory": {"type": "string"},
									"settings": {"type": "string"}
                                },
                                "required": ["grimoire", "level", "points", "xp", "skills", "summonPowers", "tasksCompleted", "redeemButton", "storeButton"]
                            },
                            "flavor": {
                                "type": "object",
                                "properties": {
                                    "taskSystem": {"type": "string"},
                                    "pointsSystem": {"type": "string"},
                                    "levelSystem": {"type": "string"},
                                    "systemMessage": {"type": "string"}
                                },
                                "required": ["taskSystem", "pointsSystem", "levelSystem", "systemMessage"]
                            },
							"levelTitles": {
                                "type": "object",
									"properties": {
									"1": {"type": "string"},
									"5": {"type": "string"},
									"10": {"type": "string"},
									"15": {"type": "string"},
									"20": {"type": "string"},
									"30": {"type": "string"},
									"40": {"type": "string"},
									"50": {"type": "string"},
									"75": {"type": "string"},
									"90": {"type": "string"},
									"100": {"type": "string"}
									},
                                "required": ["1", "5", "10", "15", "20", "30", "40", "50", "75", "90", "100"]
							}
                        },
                        "required": ["name", "uiElements", "flavor", "levelTitles"]
                    }
                }
            ];

            const messages = [
                {
                    "role": "system",
                    "content": "You are a creative assistant that helps users design custom themes. Create a coherent theme based on the user's instructions."
                },
                {
                    "role": "user",
					"content": `Create a theme with the concept: ${themeInstruction}.
					}`
				}
            ];

            const response = await fetch(`${this.plugin.settings.apiUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.apiKey}`
                },
                body: JSON.stringify({
                    model: this.plugin.settings.selectedLLMModel,
                    messages: messages,
					temperature: 0.9,
                    tools: [{ "type": "function", "function": functions[0] }],
                    tool_choice: { "type": "function", "function": { "name": "create_theme" } }
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.choices && data.choices[0] && data.choices[0].message && 
                data.choices[0].message.tool_calls && data.choices[0].message.tool_calls[0]) {
                
                const toolCall = data.choices[0].message.tool_calls[0];
                const themeData = JSON.parse(toolCall.function.arguments);
                
                const newTheme: Theme = {
                    id: 'custom',
                    name: themeData.name,
                    uiElements: themeData.uiElements,
                    flavor: themeData.flavor,
					levelTitles: themeData.levelTitles
                };
                
                this.saveCustomTheme(newTheme);
                return newTheme;
            }
            
            throw new Error("Could not generate theme");
        } catch (error) {
            console.error("Error generating theme:", error);
            throw error;
        }
    }
}

export class ThemeSelectionModal extends Modal {
    plugin: GamifyPlugin;
    themeService: ThemeService;
    
    constructor(app: App, plugin: GamifyPlugin, themeService: ThemeService) {
        super(app);
        this.plugin = plugin;
        this.themeService = themeService;
    }
    
	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Choose Theme' });

		const themesContainer = contentEl.createDiv({ cls: 'theme-selection-container' });
		themesContainer.style.display = 'flex';
		themesContainer.style.flexWrap = 'wrap';
		themesContainer.style.gap = '10px';

		const createThemeOption = (themeId: string, themeName: string) => {
			const label = themesContainer.createEl('label', { cls: 'theme-option' });
			label.style.display = 'flex';
			label.style.alignItems = 'center';
			label.style.cursor = 'pointer';
			label.style.padding = '5px 10px';
			label.style.border = '1px solid var(--interactive-accent)';
			label.style.borderRadius = '6px';

			const input = label.createEl('input', { type: 'radio', attr: { name: 'theme', value: themeId } }) as HTMLInputElement;
			input.style.marginRight = '8px';

			if (this.themeService.getCurrentTheme().id === themeId) {
				input.checked = true;
				label.style.backgroundColor = 'var(--background-modifier-hover)';
			}

			input.onclick = () => {
				this.themeService.switchTheme(themeId);
				this.close();
				new StatCardModal(this.app, this.plugin).open();
			};

			label.appendText(themeName);
		};

		if (this.plugin.statCardData?.items) {
			const purchasedThemes = this.plugin.statCardData.items.filter(item => 
				item.effect && item.effect.some(effect => effect.includes("Set theme"))
			);

			purchasedThemes.forEach(themeItem => {
				const themeId = themeItem.id.replace('_theme', '');
				const theme = this.themeService.getTheme(themeId);
				if (theme) createThemeOption(themeId, theme.name);
			});
		}

		createThemeOption('custom', 'Custom Theme');

		const customContainer = contentEl.createDiv({ cls: 'custom-theme-container' });
		customContainer.createEl('h3', { text: 'Create Custom Theme' });

		customContainer.createEl('p', {
			text: 'Generate a new theme using the LLM. This will cost 500 points.'
		});

		const customInput = new TextComponent(customContainer)
			.setPlaceholder('e.g., "Space sci-fi theme with starship terminology"');

		const inputEl = customInput.inputEl;
		inputEl.style.width = '100%';

		new ButtonComponent(customContainer)
			.setButtonText('Generate Custom Theme')
			.onClick(async () => {
				if (!customInput.getValue()) {
					new Notice('Please enter a theme concept');
					return;
				}

				if (this.plugin.statCardData.points < 500) {
					new Notice('Not enough points. You need 500 points to create a custom theme.');
					return;
				}

				try {
					this.close();
					new Notice('Generating custom theme...');
					this.plugin.statCardData.points -= 500;
					await this.themeService.generateCustomTheme(customInput.getValue());
					this.themeService.switchTheme('custom');
					this.plugin.statCardService.refreshUI();
					new StatCardModal(this.app, this.plugin).open();
				} catch (error) {
					console.error('Error generating theme:', error);
					new Notice(`Theme generation failed. ${error.message}`);
					this.plugin.statCardData.points += 500;
				}
				await this.plugin.saveStatCardData();

			});

		const backButton = new ButtonComponent(contentEl)
			.setButtonText('Back')
			.onClick(() => {
				this.close();
				new StatCardModal(this.app, this.plugin).open();
			});
	}

    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

export class StatCardService {
    private plugin: GamifyPlugin;
    private statusBarItem: HTMLElement | null = null;

    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
    }

    initializeUI() {
        this.plugin.addRibbonIcon('shield', 'Open Stats', (evt: MouseEvent) => {
            new StatCardModal(this.plugin.app, this.plugin).open();
        });

        this.statusBarItem = this.plugin.addStatusBarItem();
        this.updateStatusBar();
    }

    updateStatusBar() {
        if (this.statusBarItem) {
            this.statusBarItem.setText(
                `XP: ${Math.floor(this.plugin.statCardData.xp)} | ` +
                `Level: ${this.plugin.statCardData.level} | ` +
                `Points: ${this.plugin.statCardData.points} | ` +
                `Tasks Completed: ${this.plugin.statCardData.stats.tasksCompleted}`
            );
        }
    }

    refreshUI() {
        this.updateStatusBar();
    }
}

export class LLMTaskService {
    private plugin: GamifyPlugin;
    private keyPressCount: number = 0;
    private lastFileCount: number = 0;
    private lastFolderCount: number = 0;
    private keyboardListener: (e: KeyboardEvent) => void;
    private intervalId: number | null = null;

    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
        
        this.keyboardListener = this.handleKeyPress.bind(this);
        document.addEventListener('keydown', this.keyboardListener);
        
        this.updateFileFolderCounts();
        
        this.intervalId = window.setInterval(() => this.updateFileFolderCounts(), 60000*5); // Check every 5 minutes
        
        this.lastFileCount = this.plugin.statCardData.stats.lastFileCount || 0;
        this.lastFolderCount = this.plugin.statCardData.stats.lastFolderCount || 0;
    }

    private handleKeyPress(e: KeyboardEvent): void {
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter') {
            this.keyPressCount++;
            
            if (this.keyPressCount >= 50) {
                try {
                    this.updateWritingSkill(this.keyPressCount);
                    this.keyPressCount = 0;
                } catch (error) {
                    console.error("Error updating writing skill:", error);
                }
            }
        }
    }

    private async updateFileFolderCounts(): Promise<void> {
        try {
            const vault = this.plugin.app.vault;
            
            const allFiles = vault.getFiles();
            const fileCount = allFiles.length;
            
            const folders = new Set<string>();
            allFiles.forEach(file => {
                const parentPath = file.parent?.path;
                if (parentPath && parentPath !== '/') {
                    folders.add(parentPath);
                }
            });
            const folderCount = folders.size;
            
            this.plugin.statCardData.stats.lastFileCount = fileCount;
            this.plugin.statCardData.stats.lastFolderCount = folderCount;
            
            if (fileCount !== this.lastFileCount) {
                this.updateResearchSkill(fileCount);
                this.lastFileCount = fileCount;
            }
            
            if (folderCount !== this.lastFolderCount) {
                this.updateOrganizationSkill(folderCount);
                this.lastFolderCount = folderCount;
            }
        } catch (error) {
            console.error("Error updating file/folder counts:", error);
        }
    }

    private updateWritingSkill(keyCount: number): void {
        const skill = this.plugin.statCardData.skills.find(s => s.id === "writing");
        if (skill) {
            const xpGain = Math.floor(keyCount / 1);
            this.updateSkill(skill, xpGain);
        }		
    }

    private updateResearchSkill(fileCount: number): void {
        const skill = this.plugin.statCardData.skills.find(s => s.id === "research");
        if (skill) {
            const xpGain = Math.floor(fileCount / 5); // 1 XP per 5 files
            this.updateSkill(skill, xpGain);
        }
    }

    private updateOrganizationSkill(folderCount: number): void {
        const skill = this.plugin.statCardData.skills.find(s => s.id === "organization");
        if (skill) {
            const xpGain = Math.floor(folderCount / 5); // 1 XP per 5 folders
            this.updateSkill(skill, xpGain);
        }
    }

    private updateSkill(skill: any, xpAmount: number): void {
        if (xpAmount <= 0) return;
        
        if (this.plugin.statCardData.activeEffects?.xpMultiplier) {
            const multiplier = this.plugin.statCardData.activeEffects.xpMultiplier;
            const now = Date.now();
            
            if (multiplier.expiresAt > now) {
                xpAmount = Math.floor(xpAmount * multiplier.value);
            }
        }
        
        skill.xp += xpAmount;
        
        const nextLevel = skill.level + 1;
        const xpForNextLevel = nextLevel * 25; // level up formula needs work
        
        if (skill.xp >= xpForNextLevel) {
            skill.level = nextLevel;
            skill.xp = 0;
            new Notice(`Your ${skill.name} skill has increased to level ${skill.level}!`);
            
            this.plugin.statCardData.points += nextLevel * 2;
        }

    }

	async executeTask(instruction: string): Promise<string> {
		try {
			this.plugin.processingIndicatorService.startProcessing('llm');
			
			if (instruction.toLowerCase().includes("create theme") || 
				instruction.toLowerCase().includes("generate theme")) {
				return this.generateTheme(instruction);
			}

			const pointsCost = await this.determineTaskCost(instruction);
			new Notice(`${pointsCost} points will be expended for the task.`);

			if (this.plugin.statCardData.points < pointsCost) {
				throw new Error(`Not enough points. You need ${pointsCost} points to perform this action.`);
			}

			try {
				this.plugin.statCardData.points -= pointsCost;

				const theme = this.plugin.themeService.getCurrentTheme();
				const systemMessage = theme.flavor.systemMessage;

				const functions = [
					{
						"name": "perform_task",
						"description": "Perform a task requested by the user",
						"parameters": {
							"type": "object",
							"properties": {
								"result": {
									"type": "string",
									"description": "The result of the task execution"
								},
								"task_type": {
									"type": "string",
									"enum": ["answer", "code_generation", "analysis", "creative"],
									"description": "The type of task performed"
								},
								"title": {
									"type": "string",
									"description": "A short title describing the task result"
								}
							},
							"required": ["result"]
						}
					}
				];

				const messages = [
					{
						"role": "system",
						"content": systemMessage
					},
					{
						"role": "user",
						"content": `I'd like you to perform this task: ${instruction}`
					}
				];

				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 600000);
				
				const response = await fetch(`${this.plugin.settings.apiUrl}/v1/chat/completions`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${this.plugin.settings.apiKey}`
					},
					body: JSON.stringify({
						model: this.plugin.settings.selectedLLMModel,
						messages: messages,
						tools: [{ "type": "function", "function": functions[0] }],
						tool_choice: { "type": "function", "function": { "name": "perform_task" } }
					}),
					signal: controller.signal
				});
				
				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(`API error: ${response.status} - ${errorText}`);
				}

				const data = await response.json();
				
				let result = "";
				let title = "Untitled Task";
				
				if (data.choices && data.choices[0] && data.choices[0].message) {
					const message = data.choices[0].message;
					
					if (message.tool_calls && message.tool_calls[0]) {
						try {
							const toolCall = message.tool_calls[0];
							const functionArgs = JSON.parse(toolCall.function.arguments);
							
							if (functionArgs.result) {
								result = functionArgs.result;
								title = functionArgs.title || "Untitled Task";
							}
						} catch (e) {
							console.warn("Error parsing tool_calls arguments", e);
						}
					}

					if (!result && message.parameters && message.parameters.result) {
						result = message.parameters.result;
						title = message.parameters.title || "Untitled Task";
					}
									if (!result) {
						const responseStr = JSON.stringify(data);
						const resultRegex = /"result"\s*:\s*"((?:\\"|[^"])+)"/;
						const match = responseStr.match(resultRegex);
						if (match && match[1]) {
							result = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
							
							const titleRegex = /"title"\s*:\s*"((?:\\"|[^"])+)"/;
							const titleMatch = responseStr.match(titleRegex);
							if (titleMatch && titleMatch[1]) {
								title = titleMatch[1].replace(/\\"/g, '"');
							}
						}
					}
					if (!result && message.name === "perform_task" && message.parameters) {
						if (message.parameters.result) {
							result = message.parameters.result;
							title = message.parameters.title || "Untitled Task";
						}
					}
					
					if (!result && message.content) {
						result = message.content;
					}
					
				}
				
				if (!result) {
					console.error("Unexpected response format", data);
					throw new Error("Could not extract result from LLM response");
				}
				
				this.plugin.statCardData.stats.tasksCompleted++;
				
				await this.saveResultToVault(result, title, pointsCost);
				
				return result;
			} catch (error) {
				console.error("Error executing LLM task:", error);
			
				this.plugin.statCardData.points += pointsCost;
				
				if (error.name === 'AbortError') {
					throw new Error("The request timed out. The powers are not responding.");
				}
				
				throw error;
			}
		} finally {
			await this.plugin.saveStatCardData();			
			this.plugin.processingIndicatorService.endProcessing();
		}			
	}
    public async determineTaskCost(instruction: string): Promise<number> {
        try {
            const functions = [
                {
                    "name": "determine_cost",
                    "description": "Determine the point cost for executing a task based on complexity",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "points": {
                                "type": "number",
                                "description": "The number of points required for the task"
                            },
                            "reasoning": {
                                "type": "string",
                                "description": "Explanation of how points were calculated"
                            },
                            "complexity": {
                                "type": "string",
                                "enum": ["trivial", "simple", "moderate", "complex", "extreme"],
                                "description": "Assessment of the task's complexity"
                            }
                        },
                        "required": ["points", "reasoning", "complexity"]
                    }
                }
            ];

            const messages = [
                {
                    "role": "system",
                    "content": "You need to assign a point cost for completing a task. Assign points based on complexity: trivial (1-5 points), simple (5-10 points), moderate (10-30 points), complex (30-50 points), extreme (50-1000 points). Be fair in your assessment."
                },
                {
                    "role": "user",
                    "content": `I request your judgement for this task: "${instruction}". What is the cost?`
                }
            ];

            // Add timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000*2); // 15 second timeout
            
            const response = await fetch(`${this.plugin.settings.apiUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.apiKey}`
                },
                body: JSON.stringify({
                    model: this.plugin.settings.selectedLLMModel,
                    messages: messages,
					temperature: 5,
                    tools: [{ "type": "function", "function": functions[0] }],
                    tool_choice: { "type": "function", "function": { "name": "determine_cost" } }
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            
            if (data.choices && data.choices[0] && data.choices[0].message && 
                data.choices[0].message.tool_calls && data.choices[0].message.tool_calls[0]) {
                
                const toolCall = data.choices[0].message.tool_calls[0];
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                let cost = Math.round(functionArgs.points);
                
                if (this.plugin.statCardData.activeEffects?.storeDiscount) {
                    const discount = this.plugin.statCardData.activeEffects.storeDiscount;
                    const now = Date.now();
                    
                    if (discount.expiresAt > now) {
                        cost = Math.max(1, Math.floor(cost * (1 - discount.value)));
                    }
                }	
                return cost;				
            }
            
            throw new Error("Could not determine task cost");
        } catch (error) {
            console.error("Error determining task cost:", error);
            if (error.name === 'AbortError') {
                throw new Error("The request timed out. The dark powers are not responding.");
            }
            // Fallback to default cost
            return 10;
        }
    }

	private async generateTheme(instruction: string): Promise<string> {
		const pointsCost = 500;
		
		if (this.plugin.statCardData.points < pointsCost) {
			throw new Error(`Not enough points. You need ${pointsCost} points to create a custom theme.`);
		}

		try {

			this.plugin.statCardData.points -= pointsCost;
			

			const themeService = new ThemeService(this.plugin);
			const newTheme = await themeService.generateCustomTheme(instruction);
			

			themeService.switchTheme('custom');
			

			if (this.plugin.statCardService) {
				this.plugin.statCardService.refreshUI();
			}
			
			return `Custom theme "${newTheme.name}" has been created and activated. The UI will now use this theme's terminology and style.`;
		} catch (error) {
			console.error("Error generating theme:", error);
			
			this.plugin.statCardData.points += pointsCost;
			
			throw new Error(`Failed to generate theme: ${error.message}`);
		}
	}

	private getEnhancedFunctionDefinitions(): any[] {
		return [
			{
				"name": "perform_task",
				"description": "Perform a task requested by the user",
				"parameters": {
					"type": "object",
					"properties": {
						"result": {
							"type": "string",
							"description": "The result of the task execution"
						},
						"task_type": {
							"type": "string",
							"enum": ["answer", "code_execution", "analysis", "creative"],
							"description": "The type of task performed"
						},
						"title": {
							"type": "string",
							"description": "A short title describing the task result"
						}
					},
					"required": ["result"]
				}
			},
			{
				"name": "generate_creative_content",
				"description": "Generate creative content like stories, poems, or descriptions",
				"parameters": {
					"type": "object",
					"properties": {
						"content": {
							"type": "string",
							"description": "The creative content generated"
						},
						"title": {
							"type": "string",
							"description": "Title for the creative work"
						},
						"genre": {
							"type": "string",
							"description": "Genre or type of creative work"
						}
					},
					"required": ["content", "title"]
				}
			},
			{
				"name": "answer_question",
				"description": "Provide a direct answer to a question",
				"parameters": {
					"type": "object",
					"properties": {
						"answer": {
							"type": "string",
							"description": "The answer to the question"
						},
						"confidence": {
							"type": "string",
							"enum": ["high", "medium", "low"],
							"description": "Confidence level in the answer"
						}
					},
					"required": ["answer"]
				}
			},
			{
				"name": "provide_code",
				"description": "Generate code in response to a programming request",
				"parameters": {
					"type": "object",
					"properties": {
						"code": {
							"type": "string",
							"description": "The generated code"
						},
						"language": {
							"type": "string",
							"description": "Programming language of the code"
						},
						"explanation": {
							"type": "string",
							"description": "Explanation of how the code works"
						}
					},
					"required": ["code"]
				}
			}
		];
	}

	private extractContentFromResponse(data: any): { content: string, title: string } {
		let content = "";
		let title = "Untitled Task";
		
		if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
			return { content, title };
		}
		
		const message = data.choices[0].message;
		
		if (message.tool_calls && message.tool_calls.length > 0) {
			try {
				const toolCall = message.tool_calls[0];
				const functionName = toolCall.function.name;
				const args = JSON.parse(toolCall.function.arguments);
				
				switch(functionName) {
					case "perform_task":
						content = args.result || "";
						title = args.title || "Task Result";
						break;
					case "generate_creative_content":
						content = args.content || "";
						title = args.title || "Creative Content";
						break;
					case "answer_question":
						content = args.answer || "";
						title = "Question Answer";
						break;
					case "provide_code":
						content = args.code || "";
						if (args.explanation) {
							content += "\n\n" + args.explanation;
						}
						title = `Code (${args.language || "unknown"})`;
						break;
					default:
						for (const key in args) {
							if (typeof args[key] === "string" && args[key].length > 0) {
								content = args[key];
								break;
							}
						}
				}
			} catch (parseError) {
				console.warn("Error parsing tool call arguments", parseError);
			}
		}
		
		if (!content && message.content) {
			content = message.content;
			title = "Direct Response";
		}
		
		return { content, title };
	}

    private async saveResultToVault(content: string, title: string, pointsCost: number): Promise<void> {
        try {
            const folderPath = 'QuestLog';
            const folder = this.plugin.app.vault.getAbstractFileByPath(folderPath);
            
            if (!folder) {
                await this.plugin.app.vault.createFolder(folderPath);
            }
            
            const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
            const randomStr = Math.random().toString(36).substring(2, 8);
            const safeTitle = title ? title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20) : 'untitled';
            const filename = `${folderPath}/${timestamp}_${safeTitle}_${randomStr}.md`;
            
            const fileContent = `---
title: ${title}
created: ${new Date().toISOString()}
points_cost: ${pointsCost}
---

# ${title}

${content} 

*the portal closes....*
`;
            
            await this.plugin.app.vault.create(filename, fileContent);
            
            new Notice(`Task result saved to ${filename}`);
        } catch (error) {
            console.error("Error saving result to vault:", error);
            new Notice("Error saving task result to vault.");
        }
    }
    
    public destroy(): void {
        document.removeEventListener('keydown', this.keyboardListener);
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

export class RedeemTaskModal extends Modal {
    plugin: GamifyPlugin;
    instruction: string = '';
    
    constructor(app: App, plugin: GamifyPlugin) {
        super(app);
        this.plugin = plugin;
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        
        contentEl.createEl('h2', {text: 'Beseech Unknown Powers'});
        
        contentEl.createEl('p', {
            text: `Points Available: ${this.plugin.statCardData.points}`
        });
        
        contentEl.createEl('label', {text: 'What do you wish to request?'});
        
        const instructionInput = new TextComponent(contentEl)
            .setPlaceholder('e.g., "Write a tale of "')
            .onChange((value) => {
                this.instruction = value;
            });
        
        const inputEl = instructionInput.inputEl;
        inputEl.style.width = '100%';
        inputEl.style.height = '100px';
        
        const buttonContainer = contentEl.createDiv({cls: 'redeem-buttons'});
        
        new ButtonComponent(buttonContainer)
            .setButtonText('Dismiss')
            .onClick(() => {
                this.close();
                new StatCardModal(this.app, this.plugin).open();
            });
        
        new ButtonComponent(buttonContainer)
            .setButtonText('Request')
            .setCta()
            .onClick(async () => {
                if (!this.instruction) {
                    new Notice('You must specify your request.');
                    return;
                }
                
                try {
                    this.close();
                    new Notice('Transmitting through the ether...');
                    
                    const llmService = new LLMTaskService(this.plugin);
                    
                    const cost = await llmService.determineTaskCost(this.instruction);
                    
                    if (this.plugin.statCardData.points < cost) {
                        new Notice(`Not enough points. You need ${cost} points to perform this action.`);
                        new StatCardModal(this.app, this.plugin).open();
                        return;
                    }
                    
                    const result = await llmService.executeTask(this.instruction);
                    
                    if (this.plugin.statCardService) {
                        this.plugin.statCardService.refreshUI();
                    }
                    
                    const resultModal = new TaskResultModal(this.app, this.plugin, result);
                    resultModal.open();
                } catch (error) {
                    console.error('Error executing task:', error);
                    new Notice(`The request failed. ${error.message}`);
                    new StatCardModal(this.app, this.plugin).open();
                }
            });
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

export class TaskResultModal extends Modal {
    plugin: GamifyPlugin;
    result: string;
    
    constructor(app: App, plugin: GamifyPlugin, result: string) {
        super(app);
        this.plugin = plugin;
        this.result = result;
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        
        contentEl.createEl('h2', {text: 'Response'});
        
        const resultContainer = contentEl.createDiv({cls: 'task-result-container'});
        resultContainer.style.maxHeight = '400px';
        resultContainer.style.overflow = 'auto';
        resultContainer.style.padding = '10px';
        resultContainer.style.border = '1px solid var(--background-modifier-border)';
        resultContainer.style.margin = '10px 0';
        
        const MarkdownIt = (window as any).markdownit;
        if (MarkdownIt) {
            const md = new MarkdownIt();
            resultContainer.innerHTML = md.render(this.result);
        } else {
            resultContainer.innerHTML = this.result.replace(/\n/g, '<br>');
        }
        
        const buttonContainer = contentEl.createDiv({cls: 'task-result-buttons'});
        
        new ButtonComponent(buttonContainer)
            .setButtonText('Return to Stat Card')
            .onClick(() => {
                this.close();
                new StatCardModal(this.app, this.plugin).open();
            });
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

export class StatCardModal extends Modal {
    plugin: GamifyPlugin;
    
    constructor(app: App, plugin: GamifyPlugin) {
        super(app);
        this.plugin = plugin;
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        
        contentEl.addClass('gamify-stat-card-modal');
        
        const theme = this.plugin.themeService.getCurrentTheme();
        
        const themeButton = new ButtonComponent(contentEl)
            .setButtonText('Change Theme')
            .setClass('theme-selector-button')
            .onClick(() => {
                this.close();
                new ThemeSelectionModal(this.app, this.plugin, this.plugin.themeService).open();
            });
        if (!this.plugin.statCardData.items?.some(item => item.id === "theme_toggler")) {
            themeButton.setDisabled(true);
        }
        
        contentEl.createEl('h2', {text: theme.uiElements.grimoire, cls: 'gamify-modal-title'});
        
        const statsContainer = contentEl.createDiv({cls: 'gamify-stats-container'});
        
        const levelTitle = this.plugin.themeService.getLevelTitle(this.plugin.statCardData.level);
        statsContainer.createEl('h3', {
            text: `Level ${this.plugin.statCardData.level} ${levelTitle}`, 
            cls: 'gamify-stats-heading'
        });
        
        const xpBar = statsContainer.createDiv({cls: 'gamify-xp-bar'});
        const fillPercentage = Math.min(100, (this.plugin.statCardData.xp / this.plugin.statCardData.nextLevelXp) * 100);
        const xpBarFill = xpBar.createDiv({cls: 'gamify-xp-bar-fill'});
        xpBarFill.style.width = `${fillPercentage}%`;
        
        statsContainer.createEl('div', {
            text: `${theme.uiElements.xp}: ${Math.floor(this.plugin.statCardData.xp)}/${this.plugin.statCardData.nextLevelXp}`,
            cls: 'gamify-stat-item'
        });
        
        statsContainer.createEl('div', {
            text: `${theme.uiElements.points}: ${this.plugin.statCardData.points}`,
            cls: 'gamify-stat-item'
        });
        
        statsContainer.createEl('div', {
            text: `${theme.uiElements.tasksCompleted}: ${this.plugin.statCardData.stats.tasksCompleted}`,
            cls: 'gamify-stat-item'
        });
        
        statsContainer.createEl('div', {
            text: `Total ${theme.uiElements.points} Earned: ${this.plugin.statCardData.stats.totalPointsEarned}`,
            cls: 'gamify-stat-item'
        });

        const skillsSection = contentEl.createDiv({cls: 'gamify-skills-section'});
        skillsSection.createEl('h3', {text: theme.uiElements.skills, cls: 'gamify-section-heading'});
        
        const skillsList = skillsSection.createEl('ul', {cls: 'gamify-skills-list'});
        for (const skill of this.plugin.statCardData.skills) {
            skillsList.createEl('li', {
                text: `${skill.name}: Level ${skill.level}`,
                cls: 'gamify-skill-item'
            });
        } 
 
		if (this.plugin.statCardData.titles && this.plugin.statCardData.titles.length > 0) {
			const titlesSection = contentEl.createDiv({ cls: 'gamify-titles-section' });
			titlesSection.createEl('h3', { text: 'Titles', cls: 'gamify-section-heading' });

			const titlesList = titlesSection.createDiv({ cls: 'gamify-titles-grid' });

			for (const title of this.plugin.statCardData.titles) {
				const titleItem = titlesList.createEl('div', { cls: 'gamify-title-item gamify-glow' });

				titleItem.createEl('span', { text: `【${title.name}】`, cls: 'gamify-title-name' });

				if (title.effect && title.effect.length > 0) {
					const effectsList = titleItem.createEl('div', { cls: 'gamify-title-tooltip' });
					for (const effect of title.effect) {
						effectsList.createEl('span', { text: effect, cls: 'gamify-title-effect' });
					}
				}
			}
		}

                
		if (this.plugin.statCardData.items && this.plugin.statCardData.items.length > 0) {
			const inventorySection = contentEl.createDiv({cls: 'gamify-inventory-section'});		
            const inventoryHeader = inventorySection.createDiv({cls: 'gamify-section-header'});
            inventoryHeader.createEl('h3', {text: 'Items', cls: 'gamify-section-heading'});
            const inventoryContent = inventorySection.createDiv({cls: 'gamify-inventory-content'});
            const inventoryGrid = inventoryContent.createDiv({cls: 'gamify-inventory-grid'});
            
			function getItemRarityClass(itemCost: number | string): string {
				if (!itemCost) return 'common-item';				
				const cost = parseInt(itemCost as string); 				
				if (cost >= 500) return 'legendary-item';
				if (cost >= 200) return 'unique-item';
				if (cost >= 50) return 'rare-item';
				return 'common-item';
			}

			
			for (const item of this.plugin.statCardData.items) {
				const rarityClass = getItemRarityClass(item.cost);
				const itemEl = inventoryGrid.createEl('div', {
                    cls: `gamify-inventory-item clickable ${rarityClass}`,
                    attr: {'data-item-id': item.id}
                });
				itemEl.createEl('span', {text: item.name, cls: 'gamify-item-name'});
				const tooltipContent = itemEl.createEl('div', {
					cls: 'gamify-item-tooltip',
					attr: {'aria-label': 'Item details'}
				});
				tooltipContent.createEl('div', {text: item.description, cls: 'gamify-item-description'});
				if (item.effect && item.effect.length > 0) {
					const effectsList = tooltipContent.createEl('div', {cls: 'gamify-item-effects'});
					for (const effect of Array.isArray(item.effect) ? item.effect : [item.effect]) {
						effectsList.createEl('span', {text: effect, cls: 'gamify-item-effect'});
					}
				}
                
                itemEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleItemClick(item);
                });
			}
		}
       
        if (this.plugin.statCardData.activeEffects && 
            Object.keys(this.plugin.statCardData.activeEffects).length > 0) {
            
            const effectsSection = contentEl.createDiv({cls: 'gamify-active-effects'});
            effectsSection.createEl('h4', {text: 'Active Effects'});
            
            const now = Date.now();
            
            for (const [key, effect] of Object.entries(this.plugin.statCardData.activeEffects)) {
                if (effect.expiresAt && effect.expiresAt > now) {
                    const timeLeft = Math.floor((effect.expiresAt - now) / (60 * 1000 * 10)); // minutes
                    const effectEl = effectsSection.createDiv({cls: 'gamify-effect-item'});
                    
                    let effectName = 'Unknown Effect';
                    let effectValue = '';
                    
                    switch (key) {
                        case 'storeDiscount':
                            effectName = `Store Discount`;
                            effectValue = `${effect.value * 100}%`;
                            break;
                        case 'xpMultiplier':
                            effectName = `${theme.uiElements.xp} Multiplier`;
                            effectValue = `${effect.value}x`;
                            break;
                    }
                    
                    effectEl.createEl('span', {text: `${effectName}: ${effectValue}`});
                    effectEl.createEl('span', {text: `${timeLeft} min remaining`});
                }
            }
        }
        
        if (this.plugin.statCardData.hasFamiliar) {
            const familiarSection = contentEl.createDiv({cls: 'gamify-familiar-section'});
            familiarSection.createEl('h4', {text: 'familiar'});
            familiarSection.createEl('p', {
                text: 'Your familiar is providing daily benefits.'
            });
        }

		if (this.plugin.statCardData.achievements && this.plugin.statCardData.achievements.length > 0) {
			const achievementsSection = contentEl.createDiv({ cls: 'gamify-achievements-section' });
			achievementsSection.createEl('h3', { text: 'Achievements', cls: 'gamify-section-heading' });

			const achievementsList = achievementsSection.createEl('ul', { cls: 'gamify-achievements-list' });

			for (const achievement of this.plugin.statCardData.achievements) {
				const achievementItem = achievementsList.createEl('li', { cls: 'gamify-achievement-item' });
				
				const iconAndName = achievementItem.createEl('div', { cls: 'gamify-achievement-header' });
				iconAndName.createEl('strong', { text: achievement.name, cls: 'gamify-achievement-name' });
				
				const tooltip = achievementItem.createEl('span', { text: achievement.description, cls: 'gamify-achievement-tooltip' });
				
				achievementItem.addEventListener('mouseenter', () => {
					tooltip.style.visibility = 'visible';
					tooltip.style.opacity = '1';
				});
				
				achievementItem.addEventListener('mouseleave', () => {
					tooltip.style.visibility = 'hidden';
					tooltip.style.opacity = '0';
				});
				
				achievementItem.classList.add('gamify-glow');
			}
		}
		
		
    }
    
	private handleItemClick(item: any) {
		if (item.id === 'infinite_inventory') {
			this.plugin.activateInventoryTab();
			return;
		}
		if (item.id === 'mysterious_tablet') {
			new RedeemTaskModal(this.plugin.app, this.plugin).open();			
			return;
		}
		
		if (item.effect && item.effect.includes("Set theme.")) {			
			const themeId = item.id.replace('_theme', '');
			this.plugin.themeService.switchTheme(themeId);
			this.close();
			new StatCardModal(this.app, this.plugin).open();
			return;
		}
		
		if (item.effect) {
			try {
				const effectFunction = this.createEffectFunction(typeof item.effect === 'string' ? item.effect : "");
				effectFunction(this.plugin);
				new Notice(`Activated: ${item.name}`);
			} catch (error) {
				console.error("Error executing item effect:", error);
				new Notice("Error activating item effect.");
			}
		}
	}
    
    private createEffectFunction(effect: string): (plugin: GamifyPlugin) => void {
        try {
            return new Function("plugin", effect) as (plugin: GamifyPlugin) => void;
			
        } catch (error) {
            console.error("Invalid effect code in JSON:", error);
            return () => new Notice("Error executing item effect.");
        }
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}