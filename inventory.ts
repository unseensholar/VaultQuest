import { ItemView, WorkspaceLeaf, setIcon, EventRef, ButtonComponent, Notice } from 'obsidian';
import GamifyPlugin from './main';
import { ItemStoreService, ItemStoreModal } from './itemStore';
import { RedeemTaskModal, StatCardModal } from './services';

interface InventoryItem {
    id: string;
    name: string;
    description: string;
    icon: string;
    position?: {row: number, col: number};
    tags?: string[];
    usable?: boolean;
    useEffect?: () => void;
	effect?: string;
}

export class InventoryTabView extends ItemView {
    public containerEl: HTMLElement;
    private inventoryGrid: HTMLElement;
    private draggedItem: HTMLElement | null = null;
    private draggedItemOriginalPos: {top: number, left: number} | null = null;

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

		const headerEl = this.containerEl.createDiv({ cls: "inventory-header" });
		headerEl.createEl("h3", { text: this.plugin.themeService.getThemedTerm("inventory", "Inventory") });

		const controlsEl = headerEl.createDiv({ cls: "inventory-controls" });
		const searchEl = controlsEl.createEl("input", { 
			type: "text", 
			attr: { placeholder: "Search items..." },
			cls: "inventory-search"
		});
		searchEl.addEventListener("input", () => this.filterItems(searchEl.value));
		const storeButton = new ButtonComponent(controlsEl)
			.setButtonText(this.plugin.themeService.getThemedTerm("storeButton", "StoreButton"))
			.onClick(() => {
				new ItemStoreModal(this.app, this.plugin, this.plugin.itemStoreService).open();
			});

		storeButton.buttonEl.addClass("gamify-store-button");

		this.inventoryGrid = this.containerEl.createDiv({ cls: "inventory-grid" });

		const detailsEl = this.containerEl.createDiv({ cls: "inventory-details" });
		detailsEl.style.display = "none";

		this.plugin.registerEvent(
			this.plugin.app.workspace.on("layout-change", () => {
				this.renderInventory();
				this.updateTitle();

			})
		);

		this.renderInventory();
	}

	private updateTitle(): void {
		const headerEl = this.containerEl.querySelector(".inventory-header h3");
		if (headerEl) {
			headerEl.textContent = this.plugin.themeService.getThemedTerm("inventory", "Inventory");
		}
	}

    private renderInventory(): void {
        this.inventoryGrid.empty();
        
        type ItemType = string | { id: string; name: string; description: string };
        
        const items: InventoryItem[] = Array.isArray(this.plugin.statCardData.items)
            ? this.plugin.statCardData.items.map((item: ItemType) => {
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
                        icon: this.getIconForItem(item.id)
                    };
                }
            })
            : [];

        if (items.length === 0) {
            this.inventoryGrid.createEl("p", {
                text: "Your inventory is empty. Complete tasks to earn points and purchase items!",
                cls: "inventory-empty"
            });
            return;
        }

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
        
        for (const item of items) {
            if (!assigned.has(item.id)) {
                const pos = storedPositions[item.id];
                if (pos && pos.row === row && pos.col === col) {
                    assigned.add(item.id);
                    return {
                        id: item.id,
                        name: item.name,
                        description: item.description,
                        icon: this.getIconForItem(item.id),
                        position: { row, col }
                    };
                }
            }
        }

        for (const item of items) {
            if (!assigned.has(item.id)) {
                assigned.add(item.id);
                return {
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    icon: this.getIconForItem(item.id),
                    position: { row, col }
                };
            }
        }

        return null;
    }

    private createItemElement(slotEl: HTMLElement, item: InventoryItem): void {
		const itemEl = slotEl.createDiv({ cls: "inventory-item gamify-inventory-item" });
		itemEl.dataset.id = item.id;
		itemEl.style.display = "flex";
		itemEl.style.flexDirection = "column";
		itemEl.style.alignItems = "center";
		itemEl.style.justifyContent = "center";
		itemEl.style.padding = "4px";
		itemEl.style.height = "100%";
		itemEl.style.width = "100%";
		
		const rarityClass = this.getItemRarityClass(item.id);
		if (rarityClass) {
			itemEl.addClass(rarityClass);
		}

		const iconEl = itemEl.createDiv({ cls: "item-icon" });
		iconEl.style.fontSize = "32px";
		iconEl.style.marginBottom = "4px";
		try {
			setIcon(iconEl, item.icon);
		} catch (e) {
			setIcon(iconEl, "circle");
		}

		const nameEl = itemEl.createDiv({ cls: "item-name", text: item.name });
		nameEl.style.fontSize = "10px";
		nameEl.style.textAlign = "center";
		nameEl.style.whiteSpace = "normal";
		nameEl.style.wordBreak = "break-word";
		nameEl.style.textTransform = "capitalize";
		itemEl.setAttribute("title", item.description);
		
		itemEl.addEventListener("click", () => this.handleItemClick(item));		
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

	private getItemRarityClass(itemId: string): string {
		const legendaryItems = ["system_control", "infinite_inventory", "debugger"];
		const uniqueItems = ["ring_of_power", "familiar"];
		const rareItems = ["sword", "shield", "magic_scroll", "helmet", "armor"];
		
		if (legendaryItems.includes(itemId)) {
			return "legendary-item";
		} else if (uniqueItems.includes(itemId) || (itemId.includes("_theme"))) {
			return "unique-item";
		} else if (rareItems.includes(itemId)) {
			return "rare-item";
		} else {
			return "common-item";
		}
	}

    private getIconForItem(itemId: string): string {
		if (itemId.includes("_theme")) {
			return "book";
		}	
        const iconMap: Record<string, string> = {
            "infinite_inventory": "infinity",
            "mana_potion": "droplet",
            "sword": "sword",
            "shield": "shield",
            "gold_coin": "coins",
            "magic_scroll": "scroll",
            "helmet": "helmet",
            "armor": "vest",
            "ring_of_power": "gem",
            "boots": "footprints",
            "system_control": "key",
            "debugger": "bug",
            "familiar": "cat",
            "grimoire_theme": "book",
        };

        if (iconMap[itemId]) {
            return iconMap[itemId];
        }

        const defaultIcons = ["star", "circle", "cube", "package", "box", "bookmark"];
        const fallbackIcon = defaultIcons[itemId.length % defaultIcons.length];
        return fallbackIcon;
    }
  
    private filterItems(query: string): void {
        const items = this.inventoryGrid.querySelectorAll(".inventory-item");
        
        query = query.toLowerCase();
        items.forEach((item) => {
            const itemEl = item as HTMLElement;
            const nameEl = itemEl.querySelector(".item-name");
            const name = nameEl ? nameEl.textContent?.toLowerCase() || "" : "";
            
            if (name.includes(query)) {
                itemEl.style.display = "flex";
            } else {
                itemEl.style.display = "none";
            }
        });
    }
  
    async onClose(): Promise<void> {
    }
}