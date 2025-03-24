import { ItemView, WorkspaceLeaf, setIcon, ButtonComponent, Notice } from 'obsidian';
import GamifyPlugin from '../main';
import { ItemStoreModal } from '../features/itemStore';
import { LLMTaskService, RedeemTaskModal } from '../core/CoreServices';
import { StatCardModal } from '../features/StatCardService';

interface InventoryItem {
    id: string;
    name: string;
    description: string;
    icon: string;
    position?: {row: number, col: number};
    tags?: string[];
    usable?: boolean;
    effect?: string;
}

const RARITY = {
    LEGENDARY: ["system_control", "infinite_inventory", "debugger"],
    UNIQUE: ["ring_of_power", "familiar"],
    RARE: ["sword", "shield", "magic_scroll", "helmet", "armor"]
};

const ICON_MAP: Record<string, string> = {
    "infinite_inventory": "backpack",
    "potion": "droplet",
    "sword": "sword",
    "shield": "shield",
    "gold_coin": "coins",
    "magic_scroll": "scroll",
    "helmet": "helmet",
    "armor": "vest",
    "ring_of_power": "gem",
    "system_control": "key",
    "debugger": "bug",
    "familiar": "cat",
	"store_app": "credit-card",
};

const DEFAULT_ICONS = ["star", "circle", "cube", "package", "box", "bookmark"];

export class InventoryTabView extends ItemView {
    public containerEl: HTMLElement;
    private inventoryGrid: HTMLElement;
    private detailsEl: HTMLElement;

    constructor(leaf: WorkspaceLeaf, private plugin: GamifyPlugin) {
        super(leaf);
    }

    getViewType(): string {
        return "inventory-view";
    }

    getDisplayText(): string {
        return this.plugin.themeService.getThemedTerm("inventory", "Inventory");
    }

    getIcon(): string {
        return "package";
    }

    public refreshUI(): void {
        this.renderInventory();
    }

    async onOpen(): Promise<void> {
        this.containerEl = this.contentEl.createDiv({ cls: "inventory-container" });
        this.createHeader();
        this.inventoryGrid = this.containerEl.createDiv({ cls: "inventory-grid" });
        this.detailsEl = this.containerEl.createDiv({ cls: "inventory-details" });
        this.plugin.registerEvent(
            this.plugin.app.workspace.on("layout-change", () => {
                this.renderInventory();
                this.updateTitle();
            })
        );

        this.renderInventory();
    }

    private createHeader(): void {
        const headerEl = this.containerEl.createDiv({ cls: "inventory-header" });
        headerEl.createEl("h3", { text: this.plugin.themeService.getThemedTerm("inventory", "Inventory") });

        const controlsEl = headerEl.createDiv({ cls: "inventory-controls" });
        
        const searchEl = controlsEl.createEl("input", { 
            type: "text", 
            attr: { placeholder: "Search items..." },
            cls: "inventory-search"
        });
        searchEl.addEventListener("input", () => this.filterItems(searchEl.value));
        

    }

    private updateTitle(): void {
        const headerEl = this.containerEl.querySelector(".inventory-header h3");
        if (headerEl) {
            headerEl.textContent = this.plugin.themeService.getThemedTerm("inventory", "Inventory");
        }
    }

    private renderInventory(): void {
        this.inventoryGrid.empty();
        
        const items = this.getInventoryItems();

        if (items.length === 0) {
            this.renderEmptyInventory();
            return;
        }

        this.renderInventoryGrid(items);
    }

    private getInventoryItems(): InventoryItem[] {
        if (!Array.isArray(this.plugin.statCardData.items)) {
            return [];
        }

        return this.plugin.statCardData.items.map((item: any) => {
            if (typeof item === "string") {
                return { 
                    id: item, 
                    name: item.replace(/_/g, " "), 
                    description: "",
                    icon: this.getIconForItem(item)
                };
            } else {
                return {
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    icon: this.getIconForItem(item.id),
                    effect: item.effect
                };
            }
        });
    }

    private renderEmptyInventory(): void {
        this.inventoryGrid.createEl("p", {
            text: "Your inventory is empty. Complete tasks to earn points and purchase items!",
            cls: "inventory-empty"
        });
    }

    private renderInventoryGrid(items: InventoryItem[]): void {
        const rows = Math.max(4, Math.ceil(items.length / 6));
        const cols = 6;
        const assigned = new Set<string>();

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const slotEl = this.inventoryGrid.createDiv({ cls: "inventory-slot" });
                slotEl.dataset.row = row.toString();
                slotEl.dataset.col = col.toString();

                const itemForSlot = this.findItemForPosition(items, row, col, assigned);
                if (itemForSlot) {
                    this.createItemElement(slotEl, itemForSlot);
                }
            }
        }
    }

    private findItemForPosition(
        items: InventoryItem[],
        row: number,
        col: number,
        assigned: Set<string>
    ): InventoryItem | null {
        const storedPositions = this.plugin.settings.inventoryPositions || {};
        
        const positionedItem = items.find(item => 
            !assigned.has(item.id) && 
            storedPositions[item.id] && 
            storedPositions[item.id].row === row && 
            storedPositions[item.id].col === col
        );
        
        if (positionedItem) {
            assigned.add(positionedItem.id);
            return {
                ...positionedItem,
                position: { row, col }
            };
        }

        const unassignedItem = items.find(item => !assigned.has(item.id));
        if (unassignedItem) {
            assigned.add(unassignedItem.id);
            return {
                ...unassignedItem,
                position: { row, col }
            };
        }

        return null;
    }

    private createItemElement(slotEl: HTMLElement, item: InventoryItem): void {
        const itemEl = slotEl.createDiv({ cls: "inventory-item gamify-inventory-item" });
        itemEl.dataset.id = item.id;
        
        const rarityClass = this.getItemRarityClass(item.id);
        if (rarityClass) {
            itemEl.addClass(rarityClass);
        }

        this.createItemIcon(itemEl, item);
        this.createItemName(itemEl, item);
        
        itemEl.addEventListener("click", () => this.handleItemClick(item));        
    }

    private createItemIcon(itemEl: HTMLElement, item: InventoryItem): void {
        const iconEl = itemEl.createDiv({ cls: "item-icon" });

        try {
            setIcon(iconEl, item.icon);
        } catch (e) {
            setIcon(iconEl, "circle");
        }
    }

    private createItemName(itemEl: HTMLElement, item: InventoryItem): void {
        const nameEl = itemEl.createDiv({ cls: "item-name", text: item.name });
 
        itemEl.setAttribute("title", item.description);
    }

    private handleItemClick(item: InventoryItem): void {
        if (item.id === 'infinite_inventory') {
            this.plugin.activateInventoryTab();
            return;
        }
        
        if (item.id === 'mysterious_tablet') {
            new RedeemTaskModal(this.plugin.app, this.plugin).open();            
            return;
        }
        if (item.id === 'store_app') {
            new ItemStoreModal(this.app, this.plugin, this.plugin.itemStoreService).open();
            return;
        }		
        
        if (item.effect) {
            if (item.effect.includes("Set theme.")) {            
                const themeId = item.id.replace('_theme', '');
                this.plugin.themeService.switchTheme(themeId);
                new StatCardModal(this.app, this.plugin).open();
                
				const existingLeaves = this.app.workspace.getLeavesOfType("inventory-view");

				if (existingLeaves.length > 0) {
					existingLeaves[0].detach();
					this.plugin.activateInventoryTab();
				}
								
                return;
            }
            
            try {
                const effectFunction = this.createEffectFunction(item.effect);
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
            console.error("Invalid effect code:", error);
            return () => new Notice("Error executing item effect.");
        }
    }

    private getItemRarityClass(itemId: string): string {
        if (RARITY.LEGENDARY.includes(itemId)) {
            return "legendary-item";
        } else if (RARITY.UNIQUE.includes(itemId) || itemId.includes("_theme")) {
            return "unique-item";
        } else if (RARITY.RARE.includes(itemId)) {
            return "rare-item";
        } else {
            return "common-item";
        }
    }

    private getIconForItem(itemId: string): string {
        if (itemId.includes("_theme")) {
            return "book";
        }    
        
        return ICON_MAP[itemId] || DEFAULT_ICONS[itemId.length % DEFAULT_ICONS.length];
    }
  
    private filterItems(query: string): void {
        const items = this.inventoryGrid.querySelectorAll("inventory-item");
        
        query = query.toLowerCase();
        items.forEach((item) => {
            const itemEl = item as HTMLElement;
            const nameEl = itemEl.querySelector("item-name");
            const name = nameEl ? nameEl.textContent?.toLowerCase() || "" : "";
            
        });
    }
  
    async onClose(): Promise<void> {
    }
}
