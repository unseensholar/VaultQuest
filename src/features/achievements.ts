import { Plugin, Notice, TFile, ItemView, WorkspaceLeaf, addIcon, Menu, MarkdownRenderer } from 'obsidian';
import GamifyPlugin from '../main';
import { Achievement, AchievementCondition, AchievementReward } from '../core/types';

export const ACHIEVEMENT_VIEW_TYPE = "gamify-achievements-view";

const ACHIEVEMENTS_ICON = `<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="5"/>
  <polygon points="50,20 58,38 78,40 64,54 68,74 50,64 32,74 36,54 22,40 42,38" fill="currentColor"/>
</svg>`;

export class AchievementsView extends ItemView {
    private plugin: GamifyPlugin;
    private achievementsService: AchievementsService;

    constructor(leaf: WorkspaceLeaf, plugin: GamifyPlugin, achievementsService: AchievementsService) {
        super(leaf);
        this.plugin = plugin;
        this.achievementsService = achievementsService;
    }

    getViewType(): string {
        return ACHIEVEMENT_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Achievements";
    }

    async onOpen(): Promise<void> {
        this.displayAchievements();
    }

    async onClose(): Promise<void> {
    }

    displayAchievements(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("gamify-achievements-view");

        const header = contentEl.createEl("h2", { text: "Achievements" });
        
        const achievementsContainer = contentEl.createDiv("gamify-achievements-container");
        const achievementsList = achievementsContainer.createEl("ul", { cls: "gamify-achievements-list" });

        const allAchievements = [
            ...this.achievementsService.getDefaultAchievements(),
            ...this.achievementsService.getCustomAchievements()
        ];
        
        allAchievements.sort((a, b) => {
            const isAUnlocked = this.plugin.statCardData.achievements.some(ach => ach.id === a.id);
            const isBUnlocked = this.plugin.statCardData.achievements.some(ach => ach.id === b.id);
            return Number(isBUnlocked) - Number(isAUnlocked);
        });

        allAchievements.forEach(achievement => {
            const isUnlocked = this.plugin.statCardData.achievements.some(a => a.id === achievement.id);
            
            const achievementItem = achievementsList.createEl("li", { cls: "gamify-achievement-item" });
            
            if (isUnlocked) {
                achievementItem.addClass("unlocked");
            } else {
                achievementItem.addClass("locked");
            }
            
            const achievementHeader = achievementItem.createDiv("gamify-achievement-header");
            
            achievementHeader.createEl("span", { 
                text: achievement.name, 
                cls: "gamify-achievement-name" 
            });
            
            achievementItem.createEl("p", { 
                text: achievement.description,
                cls: "gamify-achievement-description"
            });
            
            const tooltipContent = this.createTooltipContent(achievement, isUnlocked);
            
            let activeMenu: Menu | null = null;
            
            achievementItem.addEventListener("mouseenter", (event) => {
                activeMenu = new Menu();
                activeMenu.addItem(item => {
                    item.setTitle(tooltipContent);
                    item.setDisabled(true);
                });
                
                activeMenu.showAtMouseEvent(event);
            });
            
            achievementItem.addEventListener("mouseleave", () => {
                if (activeMenu) {
                    activeMenu.hide();
                }
            });
        });
    }
    
    createTooltipContent(achievement: Achievement, isUnlocked: boolean): string {
		if (isUnlocked) {
			let content = `Condition: `;
			switch (achievement.condition.type) {
				case "writing":
					content += `Write ${achievement.condition.value} characters`;
					break;
				case "tasks_completed":
					content += `Complete ${achievement.condition.value} tasks`;
					break;
				case "streak":
					content += `Maintain a streak of ${achievement.condition.value} days`;
					break;
				case "level":
					content += `Reach level ${achievement.condition.value}`;
					break;
				case "notes_created":
					content += `Create ${achievement.condition.value} notes`;
					break;
				case "items_purchased":
					content += `Purchase ${achievement.condition.value} items`;
					break;
				case "point_collected":
					content += `Collect ${achievement.condition.value} points`;
					break;
				default:
					content += `Unknown condition type: ${achievement.condition.type}`;
			}
			
			content += `, Reward: `;
			
			switch (achievement.reward.type) {
				case "xp":
					content += `${achievement.reward.value} XP`;
					break;
				case "points":
					content += `${achievement.reward.value} Points`;
					break;
				case "title":
					content += `Title: ${achievement.reward.value}`;
					break;
				case "temp_xp_multiplier":
					content += `+${Math.round((achievement.reward.value - 1) * 100)}% XP for 24 hours`;
					break;
				case "perm_xp_multiplier":
					content += `+${Math.round((achievement.reward.value - 1) * 100)}% XP (365 days)`;
					break;
				case "temp_discount":
					content += `${Math.round(achievement.reward.value * 100)}% store discount for 24 hours`;
					break;
				case "perm_discount":
					content += `${Math.round(achievement.reward.value * 100)}% store discount (365 days)`;
					break;
				default:
					content += `Unknown reward type: ${achievement.reward.type}`;
			}
			return content;
		} else {
			return `Locked`;
		}
    }
}

export class AchievementsService {
    private plugin: GamifyPlugin;
    private customAchievements: Achievement[] = [];
    private defaultAchievements: Achievement[] = [];

    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
    }

    async initialize(): Promise<void> {
        await this.loadCustomAchievements();
        await this.createDefaultAchievementsIfNeeded();
        this.checkForAchievements();
        
        this.registerAchievementsView();
    }
    
    registerAchievementsView(): void {
        this.plugin.registerView(
            ACHIEVEMENT_VIEW_TYPE,
            (leaf) => new AchievementsView(leaf, this.plugin, this)
        );
        
        this.plugin.addCommand({
            id: 'open-achievements-view',
            name: 'Open Achievements View',
            callback: () => this.openAchievementsView()
        });
        
        addIcon('achievements-icon', ACHIEVEMENTS_ICON);
    }
    
    async openAchievementsView(): Promise<void> {
        const { workspace } = this.plugin.app;
        
        const existing = workspace.getLeavesOfType(ACHIEVEMENT_VIEW_TYPE);
        
        if (existing.length) {
            workspace.revealLeaf(existing[0]);
            return;
        }
        
        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({
                type: ACHIEVEMENT_VIEW_TYPE,
                active: true,
            });
            
            workspace.revealLeaf(leaf);
        }
    }

	async loadCustomAchievements(): Promise<void> {
		this.customAchievements = [];
		const folderPath = "QuestLog/Achievements";
		
		try {
			const files = this.plugin.app.vault.getFiles().filter(file => 
				file.path.startsWith(folderPath) && file.extension === "json"
			);

			for (const file of files) {
				try {
					const content = await this.plugin.app.vault.read(file);
					const parsedData = JSON.parse(content);

					if (Array.isArray(parsedData)) {
						this.customAchievements.push(...parsedData);
					} else {
						console.warn(`Invalid JSON format in ${file.path}`);
					}
				} catch (error) {
					console.error(`Failed to load custom achievements from ${file.path}:`, error);
				}
			}

			if (this.customAchievements.length === 0) {
				console.warn("No achievements found. Creating default Achievements.json...");
				await this.createDefaultAchievementsFile();
			}
		} catch (error) {
			console.error("Error loading Achievements:", error);
		}
	}


    async createDefaultAchievementsFile(): Promise<void> {
        const defaultAchievements = JSON.stringify([
            {
                "id": "Hello World",
                "name": "Hello World",
                "description": "Write something",
                "condition": { "type": "writing", "value": 1 },
                "reward": { "type": "points", "value": 100 }
            }
        ], null, 2);

        try {
            await this.plugin.app.vault.create('QuestLog/Achievements/Achievements_0.json', defaultAchievements);
            console.log("Default Achievements.json created.");
        } catch (error) {
            console.error("Error creating default Achievements.json:", error);
        }
    }

    async createDefaultAchievementsIfNeeded(): Promise<void> {
        this.defaultAchievements = [


        ];
    }

    checkForAchievements(): void {
        const allAchievements = [
            ...this.defaultAchievements,
            ...this.customAchievements
        ];

        allAchievements.forEach(achievement => {
            if (!this.plugin.statCardData.achievements.some(a => a.id === achievement.id) 
                && this.isAchievementConditionMet(achievement.condition)) {
                this.plugin.statCardData.achievements.push(achievement);
                this.applyAchievementReward(achievement.reward);
                new Notice(`🎉 Achievement Unlocked: ${achievement.name}!`);
            }
        });
    }

    isAchievementConditionMet(condition: AchievementCondition): boolean {
        switch (condition.type) {
            case "writing":
                return this.plugin.statCardData.writingStats.totalCharactersTyped >= condition.value;
            case "tasks_completed":
                return this.plugin.statCardData.stats.tasksCompleted >= condition.value;
            case "streak":
                return this.plugin.statCardData.streaks.currentStreak >= condition.value;
            case "level":
                return this.plugin.statCardData.level >= condition.value;
            case "notes_created":
                return this.plugin.statCardData.stats.lastFileCount >= condition.value;
            case "items_purchased":
                return this.plugin.statCardData.stats.itemsPurchased >= condition.value;
            case "point_collected":
                return this.plugin.statCardData.stats.totalPointsEarned >= condition.value;
            default:
                return false;
        }
    }

    applyAchievementReward(reward: AchievementReward): void {
        this.plugin.statCardData.activeEffects = this.plugin.statCardData.activeEffects || {};

        switch (reward.type) {
            case "xp":
                this.plugin.statCardData.xp += reward.value;
                this.plugin.checkForLevelUp();
                break;

            case "points":
                this.plugin.statCardData.points += reward.value;
                break;

            case "title":
                if (!this.plugin.statCardData.titles.some(t => t.id === reward.value)) {
                    this.plugin.statCardData.titles.push({
                        id: reward.value,
                        name: reward.value,
                        description: `Unlocked by an achievement`,
                        unlockedAt: new Date().toISOString(),
                        effect: []
                    });
                }
                break;

            case "temp_xp_multiplier":
                this.plugin.statCardData.activeEffects.xpMultiplier = {
                    value: reward.value,
                    expiresAt: Date.now() + (24 * 60 * 60 * 1000) 
                };
                new Notice(`🎉 XP Boost Activated! +${(reward.value - 1) * 100}% XP for 24 hours!`);
                break;

            case "perm_xp_multiplier":
                this.plugin.statCardData.activeEffects.xpMultiplier = {
                    value: reward.value,
                    expiresAt: Date.now() + (24 * 60 * 60 * 1000 * 365) 
                };
                new Notice(`Semi-Permanent XP Boost! You now gain +${(reward.value - 1) * 100}% more XP for 365 days.`);
                break;
                
            case "temp_discount":
                this.plugin.statCardData.activeEffects.storeDiscount = {
                    value: reward.value,
                    expiresAt: Date.now() + (24 * 60 * 60 * 1000)  
                };
                new Notice(`💰 You unlocked a ${reward.value * 100}% discount on purchases for 24 hours!`);
                break;

            case "perm_discount":
                this.plugin.statCardData.activeEffects.storeDiscount = {
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

    getCustomAchievements(): Achievement[] {
        return this.customAchievements;
    }

    getDefaultAchievements(): Achievement[] {
        return this.defaultAchievements;
    }
}