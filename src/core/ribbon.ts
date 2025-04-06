import { Plugin, Notice, addIcon } from 'obsidian';
import { RedeemTaskModal } from '../core/CoreServices';
import { ItemStoreModal } from '../features/itemStore';
import { DebugMenu } from '../debug/DebugMenu';
import GamifyPlugin from '../main';
import { ACHIEVEMENT_VIEW_TYPE, AchievementsService } from '../features/achievements';
import { NotificationListener, NotificationModal } from '../support/notificationListener';
import { ItemCrafterModal } from '../features/itemCrafter';

export class RibbonManager {
    private plugin: GamifyPlugin;
    private ribbonIcons: Map<string, HTMLElement> = new Map();

    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
    }

    async initialize() {
        
        if (this.plugin.settings.ribbonButtons.taskScan) {
            await this.addTaskScanButton();
        }
        
        if (this.plugin.settings.ribbonButtons.inventory) {
            await this.addInventoryButton();
        }
        
        if (this.plugin.settings.ribbonButtons.store) {
            await this.addStoreButton();
        }
        
        if (this.plugin.settings.ribbonButtons.request) {
            await this.addRequestButton();
        }
        
        if (this.plugin.settings.ribbonButtons.achievements) {
            await this.addAchievementsRibbonIcon();
        }
        
        if (this.plugin.settings.ribbonButtons.refresh) {
            await this.addRefreshButton();
        }
        
        if (this.plugin.settings.ribbonButtons.reload) {
            await this.addReloadButton();
        }
        
        if (this.plugin.settings.ribbonButtons.settings) {
            await this.addSettingsButton();
        }
		
        if (this.plugin.settings.ribbonButtons.notifications) {
            this.addNotificationsButton();
        }

		this.addCrafterButton()
    }

    updateRibbonIcons() {
        this.removeAllRibbonIcons();
        
        this.initialize();
    }
    
    private removeAllRibbonIcons() {
        for (const [id, element] of this.ribbonIcons) {
            element.remove();
        }
        this.ribbonIcons.clear();
    }
    
    private addRibbonIconWithTracking(icon: string, title: string, callback: () => void): HTMLElement {
        const ribbonIcon = this.plugin.addRibbonIcon(icon, title, callback);
        this.ribbonIcons.set(title, ribbonIcon);
        return ribbonIcon;
    }


    private async addTaskScanButton() {
        this.addRibbonIconWithTracking("check-circle", "Scan for Tasks", () => {
            this.plugin.taskAssessmentService.assessCompletedTasks();
            new Notice("Manual scan started.");
        });
    }

    private addNotificationsButton() {
        this.addRibbonIconWithTracking("bell", "Notification History", () => {
			new NotificationModal(this.plugin.app, this.plugin.notificationListener).open();
        });
    }
    private async addInventoryButton() {
        if (this.plugin.statCardData.ownedItems?.includes('infinite_inventory')) {
            this.addRibbonIconWithTracking("package", "Open Inventory", () => {
                this.plugin.activateInventoryTab();
            });
        }
    }

    private async addStoreButton() {
        this.addRibbonIconWithTracking("store", "Open Store", () => {
            new ItemStoreModal(this.plugin.app, this.plugin, this.plugin.itemStoreService).open();
        });
    }

    private async addRequestButton() {
        if (this.plugin.statCardData.ownedItems?.includes('mysterious_tablet')) {
            this.addRibbonIconWithTracking("zap", "Request", () => {
                new RedeemTaskModal(this.plugin.app, this.plugin).open();
            });
        }
    }

    private addAchievementsRibbonIcon(): void {
        this.addRibbonIconWithTracking(
            'achievements-icon', 
            'Achievements', 
            async () => {
                await this.plugin.achievementsService.openAchievementsView();
            }
        );
    }

    private async addRefreshButton() {
        this.addRibbonIconWithTracking("refresh-cw", "Refresh VaultQuest UI", () => {
            this.plugin.checkForLevelUp();
            this.plugin.achievementsService.checkForAchievements();
            this.plugin.statCardService.refreshUI();
        });
    }

    private async addReloadButton() {
        this.addRibbonIconWithTracking("refresh-ccw-dot", "Reload Plugin", () => {
            (this.plugin.app as any).plugins.disablePlugin(this.plugin.manifest.id);
            (this.plugin.app as any).plugins.enablePlugin(this.plugin.manifest.id);
        });
    }
    private async addCrafterButton() {	
        this.addRibbonIconWithTracking('hammer', 'Open Item Crafter', () => {
            new ItemCrafterModal(this.plugin.app, this.plugin).open();
        });	
	}
	
    private async addSettingsButton() {
        this.addRibbonIconWithTracking("settings", "Open Plugin Settings", () => {
            (this.plugin.app as any).setting.open();
            (this.plugin.app as any).setting.openTabById(this.plugin.manifest.id);
        });
    }
}
