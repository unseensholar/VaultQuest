import { App, Notice, Modal, TextComponent, ButtonComponent } from 'obsidian';
import GamifyPlugin from '../main';
import { StatCardModal } from '../features/StatCardService';

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
    private currentThemeId: string = 'gamesystem_theme';

    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
        this.currentThemeId = this.plugin.settings.themeId || 'gamesystem_theme';
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
        return this.themes[this.currentThemeId] || this.themes.gamesystem_theme;
    }

    getTheme(themeId: string): Theme {
        return this.themes[themeId] || this.themes.gamesystem_theme;
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
                    temperature: this.plugin.settings.LLM_param.temp,
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

        contentEl.addClass('theme-service-modal-container');
        contentEl.createEl('h2', { text: 'Choose Theme' });

        const themesContainer = contentEl.createDiv({ cls: 'theme-service-themes-container' });

        const createThemeOption = (themeId: string, themeName: string) => {
            const label = themesContainer.createEl('label', { cls: 'theme-service-theme-option' });
            
            const input = label.createEl('input', { 
                type: 'radio', 
                attr: { name: 'theme', value: themeId } 
            }) as HTMLInputElement;

            if (this.themeService.getCurrentTheme().id.replace('_theme', '') === themeId) {
                input.checked = true;
                label.addClass('selected');
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

        const customContainer = contentEl.createDiv({ cls: 'theme-service-custom-container' });
        customContainer.createEl('h3', { text: 'Create Custom Theme' });

        customContainer.createEl('p', {
            text: 'Generate a new theme using the LLM. This will cost 500 points.'
        });

        const customInput = new TextComponent(customContainer)
            .setPlaceholder('e.g., "Space sci-fi theme with starship terminology"');
        
        customInput.inputEl.addClass('theme-service-custom-input');

        const buttonsContainer = contentEl.createDiv({ cls: 'theme-service-buttons-container' });

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

        const backButton = new ButtonComponent(buttonsContainer)
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