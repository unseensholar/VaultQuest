import { App, Notice, Modal, ButtonComponent, TextComponent, DropdownComponent, TFile, Vault } from 'obsidian';
import GamifyPlugin from './main';
import { RedeemTaskModal } from './services';

export interface StoreItem {
    id: string;
    name: string;
    description: string;
    cost: number;
    category: 'boost' | 'ritual' | 'artifact' | 'cosmetic';
    effect: (plugin: GamifyPlugin) => void;
    imagePath?: string;
    owned: boolean;
    levelRequired?: number;     
    skillRequired?: {          
        skillId: string;
        level: number;
    };
    hidden?: boolean;          
}

export class ItemStoreService {
    private plugin: GamifyPlugin;
    private items: StoreItem[] = [];
    private debugMode: boolean = false;

    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
        this.initializeStoreItems();
        this.checkDebugStatus();

    }

    private checkDebugStatus() {
		const debugTitle = 'debugger';
		this.debugMode = this.plugin.statCardData.ownedItems.includes(debugTitle);
		if (this.debugMode) {
			console.log('Debug mode active');
		}
	}

    getAllItems(): Record<string, any> {
        return this.items;
    }

    getItem(itemId: string): any {
		return this.items.find(item => item.id === itemId) || null;		
    }

    private async initializeStoreItems() {
        this.items = [
			{
				id: 'theme_toggler',
                name: 'Theme Toggler',
                description: 'Allows you to switch themes.',
                cost: 10,
                category: 'cosmetic',
                owned: false,
                levelRequired: 1,
				hidden: false,  
                effect: (plugin: GamifyPlugin) => {
                    new Notice('You can now change themes from the stats menu!');
                }                
			},
            {
                id: 'mysterious_tablet',
                name: 'Mysterious Tablet',
                description: 'A mysterious tablet that resonates with an ethereal hum. It feels like a communicator...?',
                cost: 100,
                category: 'artifact',
                owned: false,
                levelRequired: 0,
				effect: (plugin: GamifyPlugin) => {
					new RedeemTaskModal(this.plugin.app, this.plugin).open();
					new Notice('A mysterious tablet falls into your hands. A new icon appears in the Ribbon. A new command enters your mind.');
				}
            },		
            {
                id: 'minor_xp_boost',
                name: 'Experience Potion (Minor)',
                description: 'Gain 100 immediate XP.',
                cost: 25,
                category: 'boost',
                owned: false,
                levelRequired: 0,
                effect: (plugin: GamifyPlugin) => {
                    plugin.statCardData.xp += 100;
                    new Notice('Your soul absorbs the energy, growing stronger...');
                }
            },
            {
                id: 'major_xp_boost',
                name: 'Experience Potion (Major)',
                description: 'Gain 500 immediate XP.',
                cost: 100,
                category: 'boost',
                owned: false,
                levelRequired: 10,
				hidden: true, 
                effect: (plugin: GamifyPlugin) => {
                    plugin.statCardData.xp += 500;
                    new Notice('A surge of power courses through your essence!');
                }
            },
            {
                id: 'writing_skill_boost',
                name: 'Quill of Dark Scriptures I',
                description: 'Gain 1 level in Writing skill.',
                cost: 75,
                category: 'boost',
                owned: false,
                skillRequired: { skillId: "writing", level: 2 },
				hidden: false,
                effect: (plugin: GamifyPlugin) => {
                    const skill = plugin.statCardData.skills.find(s => s.id === "writing");
                    if (skill) {
                        skill.level += 1;
                        new Notice('Your Writing skill has been augmented!');
                    }
                }
            },
            {
                id: 'research_skill_boost',
                name: 'Tome of Forbidden Knowledge I',
                description: 'Gain 1 level in Research skill.',
                cost: 75,
                category: 'boost',
                owned: false,
                skillRequired: { skillId: "research", level: 2 },
				hidden: false,
                effect: (plugin: GamifyPlugin) => {
                    const skill = plugin.statCardData.skills.find(s => s.id === "research");
                    if (skill) {
                        skill.level += 1;
                        new Notice('Your Research skill has been infused with eldritch wisdom!');
                    }
                }
            },
            {
                id: 'organization_skill_boost',
                name: 'Cataloguing System I',
                description: 'Gain 1 level in Organization skill.',
                cost: 75,
                category: 'boost',
                owned: false,
                skillRequired: { skillId: "organization", level: 2 },
				hidden: false,
                effect: (plugin: GamifyPlugin) => {
                    const skill = plugin.statCardData.skills.find(s => s.id === "organization");
                    if (skill) {
                        skill.level += 1;
                        new Notice('Your Organization skill has been enhanced with supernatural precision!');
                    }
                }
            },
            {
                id: 'dark_ritual_discount',
                name: 'Blood Pact I',
                description: 'All requests cost 20% less for 24 hours.',
                cost: 150,
                category: 'ritual',
                owned: false,
                levelRequired: 10,
				hidden: false,
                effect: (plugin: GamifyPlugin) => {
                    plugin.statCardData.activeEffects = plugin.statCardData.activeEffects || {};
                    plugin.statCardData.activeEffects.storeDiscount = {
                        value: 0.2, // 20% discount
                        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
                    };
                    new Notice('A discount... how quaint...');
                }
            },
			{
				id: 'demonic_theme',
				name: 'Demonic Pact',
				description: 'The Grimoire emits a disturbing light.',
				cost: 200,
				category: 'cosmetic',
				owned: false,
				levelRequired: 5,
				hidden: false,  
				effect: (plugin: GamifyPlugin) => {
					new Notice('You hear the echoes of demonic screams.');
				}
			},			
			{
				id: 'celestial_theme',
				name: 'Celestial Codex',
				description: 'A radiant transformation, aligning your interface with the heavens.',
				cost: 200,
				category: 'cosmetic',
				owned: false,
				levelRequired: 5,
				hidden: false,  
				effect: (plugin: GamifyPlugin) => {
					new Notice('Your interface now shimmers with cosmic brilliance.');
				}
			},
			{
				id: 'cybernetic_theme',
				name: 'Neural Interface',
				description: 'A sleek, high-tech upgrade, turning your UI into a cybernetic control hub.',
				cost: 200,
				category: 'cosmetic',
				owned: false,
				levelRequired: 10,
				hidden: false,  
				effect: (plugin: GamifyPlugin) => {
					new Notice('System update complete. Cybernetic enhancements activated.');
				}
			},
			{
				id: 'arcane_theme',
				name: 'Arcane Tome',
				description: 'A mystical upgrade, bathing your interface in ancient magic.',
				cost: 200,
				category: 'cosmetic',
				owned: false,
				levelRequired: 10,
				hidden: true,  
				effect: (plugin: GamifyPlugin) => {
					new Notice('Arcane glyphs swirl around you as your Tome of Elders awakens.');
				}
			},
			{
				id: 'eldritch_theme',
				name: 'Necronomicon',
				description: 'A disturbing, otherworldly theme, for fans of eldritch horror.',
				cost: 200,
				category: 'cosmetic',
				owned: false,
				levelRequired: 10,
				hidden: true,  
				effect: (plugin: GamifyPlugin) => {
					new Notice('The shadows deepen. You hear whispers in forgotten tongues...');
				}
			},
			{
				id: 'rogue_theme',
				name: 'Phantom’s Veil',
				description: 'A shadowy, assassin-inspired theme for those who thrive in secrecy.',
				cost: 200,
				category: 'cosmetic',
				owned: false,
				levelRequired: 10,
				hidden: true,  
				effect: (plugin: GamifyPlugin) => {
					new Notice('You vanish into the shadows, your interface adapting to the underworld.');
				}
			},
            {
                id: 'xp_multiplier',
                name: 'Soul Binding Contract',
                description: 'Gain 1.5x XP from all activities for 24 hours.',
                cost: 175,
                category: 'ritual',
                owned: false,
                levelRequired: 15,
                effect: (plugin: GamifyPlugin) => {
                    plugin.statCardData.activeEffects = plugin.statCardData.activeEffects || {};
                    plugin.statCardData.activeEffects.xpMultiplier = {
                        value: 1.5,
                        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
                    };
                    new Notice('Your soul now absorbs more energy from your labors...');
                }
            },
            {
                id: 'familiar',
                name: 'Familiar',
                description: 'Summon a small familiar that provides random bonuses each day.',
                cost: 300,
                category: 'artifact',
                owned: false,
                levelRequired: 50,
                hidden: false, 
                effect: (plugin: GamifyPlugin) => {
                    plugin.statCardData.hasFamiliar = true;
                    this.setupFamiliarDailyBonus();
                    new Notice('A small creature materializes, bound to your service!');
                }
            },
			{
				id: 'infinite_inventory',
				name: 'Infinite Inventory',
				description: 'A storage tab to store your items.',
				cost: 500,
				category: 'artifact',
				owned: false,
				levelRequired: 1,
				hidden: true,
				effect: (plugin: GamifyPlugin) => {
                    
					new Notice('You bought an Inventory Box!');
				}
			},
			{
				id: 'system_control',
				name: 'Administrative Dominion',
				description: 'Gain administrative access to the system.',
				cost: 500,
				category: 'artifact',
				owned: false,
				levelRequired: 100,
				hidden: false,
				effect: (plugin: GamifyPlugin) => {
					const administratorTitle = {
						id: "system_control",
						name: "Administrator",
						description: "A title given to those with control over the system.",
						unlockedAt: new Date().toISOString(),
						effect: [
							"Grants full access to all system features",
							"Allows modification of core settings"
						]
					};
					if (!plugin.statCardData.titles.some(title => title.id === "system_control")) {
						plugin.statCardData.titles.push(administratorTitle);
					}
					new Notice('You have been granted Administrator rights!');
					}
			},
			{
				id: 'debugger',
				name: 'Debugger Rights',
				description: 'Unlocks hidden developer tools.',
				cost: 500,
				category: 'artifact',
				owned: false,
				levelRequired: 10,
				hidden: true,
				effect: (plugin: GamifyPlugin) => {
					const debuggerTitle = {
						id: "debugger",
						name: "Debugger",
						description: "A title granted to those who uncover and resolve hidden issues.",
						unlockedAt: new Date().toISOString(),
						effect: [
							"Unlocks hidden developer tools"
						]
					};
					if (!plugin.statCardData.titles.some(title => title.id === "debugger")) {
						plugin.statCardData.titles.push(debuggerTitle);
					}
					
					new Notice('You have been granted Debugger rights!');
					}
			}				
        ];
        
		await this.loadCustomItems();
		
        if (!this.plugin.statCardData.ownedItems) {
            this.plugin.statCardData.ownedItems = [];
        }
        if (this.plugin.statCardData.ownedItems) {
            for (const item of this.items) {
                if (this.plugin.statCardData.ownedItems.includes(item.id)) {
                    item.owned = true;
                }
            }
        } else {
            this.plugin.statCardData.ownedItems = [];
        }
    }

    private async setupFamiliarDailyBonus() {
        const now = new Date();
        const today = now.toDateString();
        
        if (this.plugin.statCardData.lastFamiliarBonusDate !== today) {
            const bonusType = Math.floor(Math.random() * 2);
			const randomBonus = Math.floor(Math.random() * 100);
            
            switch (bonusType) {
                case 0:
                    this.plugin.statCardData.xp += randomBonus;
                    new Notice(`Your familiar brings you a gift of ${randomBonus} XP!`);
                    break;
                case 1:
                    this.plugin.statCardData.points += randomBonus;
                    new Notice(`Your familiar has collected ${randomBonus} tokens for you!`);
                    break;
            }
            
            this.plugin.statCardData.lastFamiliarBonusDate = today;
            //await this.plugin.saveStatCardData();
        }
    }



    getItems(): StoreItem[] {
        if (this.debugMode) {
            return this.items;
        }
        
        return this.items.filter(item => {
            if (item.hidden && !this.meetsRequirements(item)) {
                return false;
            }
            
            return true;
        });
    }

    meetsRequirements(item: StoreItem): boolean {
        if (this.debugMode) {
            return true;
        }
        
        if (item.levelRequired && this.plugin.statCardData.level < item.levelRequired) {
            return false;
        }
        
        if (item.skillRequired) {
			const skill = this.plugin.statCardData.skills.find(s => s.id === item.skillRequired?.skillId);
            if (!skill || skill.level < item.skillRequired.level) {
                return false;
            }
        }
        
        return true;
    }

    getRequirementText(item: StoreItem): string {
        if (this.debugMode) {
            return 'Debug Mode Active';
        }
        
        const requirements: string[] = [];
  
        if (item.levelRequired && this.plugin.statCardData.level < item.levelRequired) {
            requirements.push(`Level ${item.levelRequired} required`);
        }
        
        if (item.skillRequired) {
            const skill = this.plugin.statCardData.skills.find(s => s.id === item.skillRequired?.skillId);
            const skillName = skill ? skill.name : item.skillRequired?.skillId;
            
            if (!skill || skill.level < item.skillRequired.level) {
                requirements.push(`${skillName} level ${item.skillRequired.level} required`);
            }
        }
        
        return requirements.join(', ');
    }

	async loadCustomItems() {
		const folderPath = "QuestLog/StoreInventory";
		const files = this.plugin.app.vault.getFiles().filter(file => file.path.startsWith(folderPath) && file.extension === "json");

		for (const file of files) {
			try {
				const content = await this.plugin.app.vault.read(file);
				const customItems: StoreItem[] = JSON.parse(content);

				customItems.forEach(item => {
					if (!this.items.find(existingItem => existingItem.id === item.id)) {
						this.items.push({ 
							...item, 
							effect: this.createEffectFunction(typeof item.effect === 'string' ? item.effect : "")
						});
					}
				});
			} catch (error) {
				console.error(`Failed to load custom item from ${file.path}:`, error);
			}
		}
	}

	private createEffectFunction(effect: string): (plugin: GamifyPlugin) => void {
		try {
			return new Function("plugin", effect) as (plugin: GamifyPlugin) => void;
		} catch (error) {
			console.error("Invalid effect code in JSON:", error);
			return () => new Notice("Error executing custom item effect.");
		}
	}

    async purchaseItem(itemId: string): Promise<boolean> {
        const item = this.items.find(i => i.id === itemId);
        
        if (!item) {
            new Notice('Item not found in the catalogue.');
            return false;
        }
        
        if (item.category !== 'boost' && item.category !== 'ritual') {
			if (this.plugin.statCardData.items.some(items => items.id === item.id)) {
				new Notice('You already own this artifact.');
				return false;
			}
        }
        
        if (this.plugin.statCardData.points < item.cost) {
            new Notice(`Not enough tokens. You need ${item.cost} tokens to purchase this item.`);
            return false;
        }
        
        if (!this.meetsRequirements(item)) {
            new Notice(`You do not meet the requirements: ${this.getRequirementText(item)}`);
            return false;
        }
        
        this.plugin.statCardData.points -= item.cost;
         
		if (item.category === 'artifact') {
			item.owned = true;
			if (!this.plugin.statCardData.ownedItems.includes(item.id)) {
				this.plugin.statCardData.ownedItems.push(item.id);
				this.plugin.statCardData.items.push({
					id: item.id,
					name: item.name,
					cost: item.cost,
					description: item.description,
					unlockedAt: new Date().toISOString(),
					effect: [""]
				});
			}
		}
 
 		if (item.category === 'cosmetic') {
			item.owned = true;
			this.plugin.themeService.switchTheme(item.id);
			if (!this.plugin.statCardData.items.some(items => items.id === item.id)) {
				this.plugin.statCardData.items.push({
					id: item.id,
					name: item.name,
					description: item.description,
					cost: item.cost,
					unlockedAt: new Date().toISOString(),
					effect: ["Set theme."]

				});
			}
		}
 
        item.effect(this.plugin);
		this.plugin.checkForLevelUp();

        this.plugin.statCardData.stats.itemsPurchased = 
            (this.plugin.statCardData.stats.itemsPurchased || 0) + 1;
        
        //await this.plugin.saveStatCardData();
		
		this.plugin.app.workspace.trigger("layout-change");
        await this.plugin.statCardService.refreshUI();
        return true;
    }
}

export class ItemStoreModal extends Modal {
    private plugin: GamifyPlugin;
    private storeService: ItemStoreService;
    private selectedCategory: string = 'all';
    private sortOption: string = 'default';
    
    constructor(app: App, plugin: GamifyPlugin, storeService: ItemStoreService) {
        super(app);
        this.plugin = plugin;
        this.storeService = storeService;
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        contentEl.addClass('gamify-store-modal');
             
        contentEl.createEl('h2', {text: 'Item Store', cls: 'gamify-modal-title'});
        
        contentEl.createEl('div', {
            text: `Available Tokens: ${this.plugin.statCardData.points}`,
            cls: 'gamify-points-display'
        });
        
        const filterContainer = contentEl.createDiv({cls: 'gamify-store-filter'});

        filterContainer.style.display = 'flex';
        filterContainer.style.alignItems = 'center';
        filterContainer.style.gap = '15px';
        filterContainer.style.margin = '10px 0';
        filterContainer.style.padding = '8px 12px';
        filterContainer.style.backgroundColor = 'var(--background-secondary)';
        filterContainer.style.borderRadius = '6px';
        
        const categoryLabel = filterContainer.createSpan({text: 'Category:'});
        categoryLabel.style.fontSize = '0.9em';
        categoryLabel.style.fontWeight = 'bold';
        
        const categoryDropdown = new DropdownComponent(filterContainer);
        categoryDropdown.selectEl.style.minWidth = '120px';
        categoryDropdown.selectEl.style.height = '28px';
        categoryDropdown.selectEl.style.padding = '0 8px';
        categoryDropdown.selectEl.style.marginLeft = '5px';
        
        categoryDropdown.addOption('all', 'All Items');
        categoryDropdown.addOption('boost', 'Boosts');
        categoryDropdown.addOption('ritual', 'Rituals');
        categoryDropdown.addOption('artifact', 'Artifacts');
        categoryDropdown.addOption('cosmetic', 'Cosmetics');
        
        categoryDropdown.setValue(this.selectedCategory);
        categoryDropdown.onChange(value => {
            this.selectedCategory = value;
            this.renderItems();
        });
        
        // Divider
        const divider = filterContainer.createSpan({text: '|'});
        divider.style.color = 'var(--text-muted)';
        divider.style.margin = '0 5px';
        
        // Sort label and dropdown
        const sortLabel = filterContainer.createSpan({text: 'Sort by:'});
        sortLabel.style.fontSize = '0.9em';
        sortLabel.style.fontWeight = 'bold';
        
        const sortDropdown = new DropdownComponent(filterContainer);
        sortDropdown.selectEl.style.minWidth = '140px';
        sortDropdown.selectEl.style.height = '28px';
        sortDropdown.selectEl.style.padding = '0 8px';
        sortDropdown.selectEl.style.marginLeft = '5px';
        
        sortDropdown.addOption('default', 'Default');
        sortDropdown.addOption('cost_asc', 'Cost (Low to High)');
        sortDropdown.addOption('cost_desc', 'Cost (High to Low)');
        sortDropdown.addOption('name_asc', 'Name (A to Z)');
        sortDropdown.addOption('name_desc', 'Name (Z to A)');
        
        sortDropdown.setValue(this.sortOption);
        sortDropdown.onChange(value => {
            this.sortOption = value;
            this.renderItems();
        });
        
        const itemsContainer = contentEl.createDiv({cls: 'gamify-store-items'});
        itemsContainer.id = 'store-items-container';
        
        this.renderItems();        
        // Back button
        const buttonContainer = contentEl.createDiv({cls: 'gamify-store-buttons'});
        
    }
    
    renderItems() {
        const itemsContainer = document.getElementById('store-items-container');
        if (!itemsContainer) return;
        
        itemsContainer.empty();
        
        let items = this.storeService.getItems().filter(item => 
            this.selectedCategory === 'all' || item.category === this.selectedCategory
        );
        
        items = this.sortItems(items);
        
        if (items.length === 0) {
            itemsContainer.createEl('p', {
                text: 'No items available in this category.',
                cls: 'gamify-no-items'
            });
            return;
        }
        
        for (const item of items) {
            const itemEl = itemsContainer.createDiv({cls: 'gamify-store-item'});
            
            const itemHeader = itemEl.createDiv({cls: 'gamify-item-header'});
            itemHeader.createEl('h3', {text: item.name, cls: 'gamify-item-title'});
            itemHeader.createEl('span', {
                text: `${item.cost} tokens`,
                cls: 'gamify-item-cost'
            });
            
            itemEl.createEl('p', {
                text: item.description,
                cls: 'gamify-item-description'
            });
            
            let categoryName = '';
            switch (item.category) {
                case 'boost': categoryName = 'Boost'; break;
                case 'ritual': categoryName = 'Ritual'; break;
                case 'artifact': categoryName = 'Artifact'; break;
                case 'cosmetic': categoryName = 'Cosmetic Upgrade'; break;
            }
            
            itemEl.createEl('span', {
                text: categoryName,
                cls: `gamify-item-category gamify-category-${item.category}`
            });
            
            const meetsRequirements = this.storeService.meetsRequirements(item);
            if (!meetsRequirements) {
                const reqText = this.storeService.getRequirementText(item);
                const reqLabel = itemEl.createEl('div', {
                    text: reqText,
                    cls: 'gamify-item-requirement'
                });
                reqLabel.style.color = 'crimson';
                reqLabel.style.fontStyle = 'italic';
                reqLabel.style.margin = '5px 0';
            }
            
            const purchaseButton = new ButtonComponent(itemEl) 
                .setButtonText((this.plugin.statCardData.items.some(items => items.id === item.id) && (item.category === 'artifact' || item.category === 'cosmetic')) 
                    ? 'Owned' 
                    : 'Purchase')
                .onClick(async () => {
                    const success = await this.storeService.purchaseItem(item.id);
                    if (success) {
                        const pointsDisplay = document.querySelector('.gamify-points-display');
                        if (pointsDisplay) {
                            pointsDisplay.textContent = `Available Tokens: ${this.plugin.statCardData.points}`;
                        }
                        
                        if (item.category === 'artifact' || item.category === 'cosmetic') {
                            this.renderItems();
                        }
                    }
                });
            
            if (((this.plugin.statCardData.items.some(items => items.id === item.id)) && ((item.category === 'artifact') || item.category === 'cosmetic'))) {
                purchaseButton.setDisabled(true);
            }


        }
    }
	
    private sortItems(items: StoreItem[]): StoreItem[] {
        switch (this.sortOption) {
            case 'cost_asc':
                return [...items].sort((a, b) => a.cost - b.cost);
            case 'cost_desc':
                return [...items].sort((a, b) => b.cost - a.cost);
            case 'name_asc':
                return [...items].sort((a, b) => a.name.localeCompare(b.name));
            case 'name_desc':
                return [...items].sort((a, b) => b.name.localeCompare(a.name));
            default:
                return items;
        }
    }
	
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}