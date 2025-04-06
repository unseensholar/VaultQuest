import { App, Notice, Modal, ButtonComponent, DropdownComponent } from 'obsidian';
import GamifyPlugin from '../main';
import { RedeemTaskModal } from '../core/CoreServices';
import { initializeStoreItems } from '../features/initializeStoreItems';
import { EffectType, EffectParams, EffectService} from '../features/effectService';

export interface StoreItem {
    id: string;
    name: string;
    description: string;
    cost: number;
    category: 'boost' | 'ritual' | 'artifact' | 'cosmetic' | 'material';
    owned: boolean;
    levelRequired?: number;     
    skillRequired?: {          
        skillId: string;
        level: number;
    };
    hidden?: boolean;
    imagePath?: string;
    
    effectType: EffectType;
    effectParams?: EffectParams;
    
    effect?: (plugin: GamifyPlugin) => void;
}
export class ItemStoreService {
    private plugin: GamifyPlugin;
    private items: StoreItem[] = [];
    private debugMode: boolean = false;
    private effectService: EffectService;

    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
        this.effectService = new EffectService(plugin);
        this.initializeStore();
    }

    async initializeStore() {
        this.items = await initializeStoreItems(this.plugin);
        this.syncOwnedItems();
    }

    private syncOwnedItems() {
        if (!this.plugin.statCardData.ownedItems) {
            this.plugin.statCardData.ownedItems = [];
            return;
        }
        
        for (const item of this.items) {
            item.owned = this.plugin.statCardData.ownedItems.includes(item.id);
        }
    }

    getAllItems(): StoreItem[] {
        return this.items;
    }

    getItem(itemId: string): StoreItem | null {
        return this.items.find(item => item.id === itemId) || null;
    }

    getItems(): StoreItem[] {
        if (this.debugMode) {
            return this.items;
        }
        
        return this.items.filter(item => 
            !(item.hidden && !this.meetsRequirements(item))
        );
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
		
        if (this.plugin.statCardData.activeEffects.storeDiscount) {
			const discountPercent = Math.round(this.plugin.statCardData.activeEffects.storeDiscount.value* 100);
			new Notice(`Discount active: ${discountPercent}%!`);	this.plugin.statCardData.points -= Math.round(item.cost*(1-(discountPercent/100)));
        } else {
        this.plugin.statCardData.points -= item.cost;			
		}
          
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
 
        this.applyItemEffect(item);
        
        this.plugin.checkForLevelUp();

        this.plugin.statCardData.stats.itemsPurchased = 
            (this.plugin.statCardData.stats.itemsPurchased || 0) + 1;
        
        this.plugin.app.workspace.trigger("layout-change");
        await this.plugin.statCardService.refreshUI();
        return true;
    }

	private applyItemEffect(item: StoreItem): void {
		try {
			// First try the new effect system
			if (item.effectType) {
				this.effectService.applyEffect(item.effectType, item.effectParams || {});
				return;
			}
			
			// Fall back to legacy effect function if available
			if (item.effect && typeof item.effect === 'function') {
				item.effect(this.plugin);
				return;
			}
			
			// If neither is available, show a generic notice
			new Notice(`You have acquired: ${item.name}`);
		} catch (error) {
			console.error("Error applying item effect:", error);
			new Notice(`Error applying effect for item: ${item.name}`);
		}
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
        
        this.renderFilterControls(contentEl);
        
        const itemsContainer = contentEl.createDiv({cls: 'gamify-store-items'});
        itemsContainer.id = 'store-items-container';
		this.storeService.initializeStore();
        this.renderItems();
        contentEl.createDiv({cls: 'gamify-store-buttons'});
    }
    
    private renderFilterControls(contentEl: HTMLElement) {
        const filterContainer = contentEl.createDiv({cls: 'gamify-store-filter'});
        
        const categoryLabel = filterContainer.createSpan({text: 'Category:', cls: 'gamify-filter-label'});
        
        const categoryDropdown = new DropdownComponent(filterContainer);
        categoryDropdown.selectEl.addClass('gamify-dropdown');
        
        categoryDropdown.addOption('all', 'All Items');
        categoryDropdown.addOption('boost', 'Boosts');
        categoryDropdown.addOption('ritual', 'Rituals');
        categoryDropdown.addOption('artifact', 'Artifacts');
        categoryDropdown.addOption('cosmetic', 'Cosmetics');
        categoryDropdown.addOption('material', 'Materials');
        
        categoryDropdown.setValue(this.selectedCategory);
        categoryDropdown.onChange(value => {
            this.selectedCategory = value;
            this.renderItems();
        });
        
        // Divider
        const divider = filterContainer.createSpan({text: '|', cls: 'gamify-filter-divider'});
        
        // Sort label and dropdown
        const sortLabel = filterContainer.createSpan({text: 'Sort by:', cls: 'gamify-filter-label'});
        
        const sortDropdown = new DropdownComponent(filterContainer);
        sortDropdown.selectEl.addClass('gamify-dropdown');
        
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
        
        items.forEach(item => this.renderItemElement(itemsContainer, item));
    }
    
    private renderItemElement(container: HTMLElement, item: StoreItem) {
        const itemEl = container.createDiv({cls: 'gamify-store-item'});
        
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
        
        const categoryNames = {
            'boost': 'Boost',
            'ritual': 'Ritual',
            'artifact': 'Artifact',
            'cosmetic': 'Cosmetic Upgrade',
            'material': 'Material'			
        };
        
        itemEl.createEl('span', {
            text: categoryNames[item.category],
            cls: `gamify-item-category gamify-category-${item.category}`
        });
        
        this.renderRequirements(itemEl, item);
        this.renderPurchaseButton(itemEl, item);
    }
    
    private renderRequirements(container: HTMLElement, item: StoreItem) {
        const meetsRequirements = this.storeService.meetsRequirements(item);
        if (!meetsRequirements) {
            const reqText = this.storeService.getRequirementText(item);
            const reqLabel = container.createEl('div', {
                text: reqText,
                cls: 'gamify-item-requirement'
            });
        }
    }
    
    private renderPurchaseButton(container: HTMLElement, item: StoreItem) {
        const isOwned = this.plugin.statCardData.items.some(i => i.id === item.id) && 
                        (item.category === 'artifact' || item.category === 'cosmetic');
        
        const purchaseButton = new ButtonComponent(container) 
            .setButtonText(isOwned ? 'Owned' : 'Purchase')
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
        
        if (isOwned) {
            purchaseButton.setDisabled(true);
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