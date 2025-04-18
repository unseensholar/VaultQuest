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
		const Achievementsfolder = this.plugin.app.vault.getAbstractFileByPath(folderPath);
		if (!Achievementsfolder) {
			await this.plugin.app.vault.createFolder(folderPath);
			console.log(`Created plugin data folder: ${folderPath}`);
		}		
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
            {
                "id": "Hello World",
                "name": "Hello World!",
                "description": "Write something for beginner's bonus.",
                "condition": { "type": "writing", "value": 1 },
                "reward": { "type": "points", "value": 100 }
            },
            {
            	"id": "first_steps",
            	"name": "First Steps",
            	"description": "Complete your first task.",
            	"condition": { "type": "tasks_completed", "value": 1 },
            	"reward": { "type": "xp", "value": 10 }
            },
            {
            	"id": "task_initiate",
            	"name": "Task Initiate",
            	"description": "Complete 10 tasks.",
            	"condition": { "type": "tasks_completed", "value": 10 },
            	"reward": { "type": "xp", "value": 50 }
            },
            {
            	"id": "task_master",
            	"name": "Task Master",
            	"description": "Complete 100 tasks.",
            	"condition": { "type": "tasks_completed", "value": 100 },
            	"reward": { "type": "xp", "value": 250 }
            },
            {
            	"id": "task_master_discount",
            	"name": "Task Master's Right",
            	"description": "Complete 100 tasks.",
            	"condition": { "type": "tasks_completed", "value": 100 },
            	"reward": { "type": "perm_discount", "value": 0.2 }
            },
            {
            	"id": "relentless_worker",
            	"name": "Relentless Worker",
            	"description": "Complete 500 tasks.",
            	"condition": { "type": "tasks_completed", "value": 500 },
            	"reward": { "type": "title", "value": "Relentless" }
            },
            {
            	"id": "keepatit",
            	"name": "Keep At It",
            	"description": "Complete 1,000 tasks.",
            	"condition": { "type": "tasks_completed", "value": 1000 },
            	"reward": { "type": "special_item", "value": "Golden Notebook" }
            },
            {
            	"id": "daily_streak_3",
            	"name": "Getting Started",
            	"description": "Complete tasks for 3 days in a row.",
            	"condition": { "type": "streak", "value": 3 },
            	"reward": { "type": "xp", "value": 50 }
            },
            {
            	"id": "daily_streak_5",
            	"name": "Good Rhythm",
            	"description": "Complete tasks for 5 days in a row.",
            	"condition": { "type": "streak", "value": 5 },
            	"reward": { "type": "temp_xp_multiplier", "value": 2 }
            },
            {
            	"id": "daily_streak_7",
            	"name": "Consistency King",
            	"description": "Complete tasks for 7 days in a row.",
            	"condition": { "type": "streak", "value": 7 },
            	"reward": { "type": "xp", "value": 250 }
            },
            {
            	"id": "daily_streak_10",
            	"name": "Hyper Fixated",
            	"description": "Complete tasks for 10 days in a row.",
            	"condition": { "type": "streak", "value": 10 },
            	"reward": { "type": "temp_xp_multiplier", "value": 5 }
            },
            {
            	"id": "daily_streak_30",
            	"name": "One-Month Marathon",
            	"description": "Complete tasks for 30 days straight.",
            	"condition": { "type": "streak", "value": 30 },
            	"reward": { "type": "title", "value": "The Unstoppable" }
            },
            {
            	"id": "daily_streak_30_buff",
            	"name": "Persistent",
            	"description": "Complete tasks for 30 days straight.",
            	"condition": { "type": "streak", "value": 30 },
            	"reward": { "type": "perm_xp_multiplier", "value": "100" }
            },
            {
            	"id": "discipline_master",
            	"name": "Discipline Master",
            	"description": "Maintain a 100-day task streak.",
            	"condition": { "type": "streak", "value": 100 },
            	"reward": { "type": "special_item", "value": "Chrono Badge" }
            },
            {
            	"id": "longest_streak",
            	"name": "Discipline Master",
            	"description": "Achieve a 100-day streak.",
            	"condition": { "type": "streak", "value": 100 },
            	"reward": { "type": "title", "value": "True Legend" }
            },
            {
            	"id": "note_taker",
            	"name": "Note Taker",
            	"description": "Write 1,000 characters in your notes.",
            	"condition": { "type": "writing", "value": 1000 },
            	"reward": { "type": "xp", "value": 20 }
            },
            {
            	"id": "word_smith",
            	"name": "Wordsmith",
            	"description": "Write 10,000 characters.",
            	"condition": { "type": "writing", "value": 10000 },
            	"reward": { "type": "xp", "value": 100 }
            },
            {
            	"id": "scribe_master",
            	"name": "Scribe Master",
            	"description": "Write 50,000 characters.",
            	"condition": { "type": "writing", "value": 50000 },
            	"reward": { "type": "title", "value": "Master Scribe" }
            },
            {
            	"id": "literary_titan",
            	"name": "Literary Titan",
            	"description": "Write 100,000 characters.",
            	"condition": { "type": "writing", "value": 100000 },
            	"reward": { "type": "xp", "value": 300 }
            },
            {
            	"id": "notes_hoarder",
            	"name": "Archivist",
            	"description": "Write 100 notes.",
            	"condition": { "type": "notes_created", "value": 100 },
            	"reward": { "type": "xp", "value": 150 }
            },
            {
            	"id": "loyal_user",
            	"name": "Loyal User",
            	"description": "Use the plugin for 100 days.",
            	"condition": { "type": "plugin_usage", "value": 100 },
            	"reward": { "type": "special_item", "value": "Token of Thanks" }
            },
            {
            	"id": "loyal_user_discount",
            	"name": "Loyal User's Reward",
            	"description": "Use the plugin for 100 days.",
            	"condition": { "type": "plugin_usage", "value": 100 },
            	"reward": { "type": "perm_discount", "value": 0.2 }
            },
            {
            	"id": "level_2",
            	"name": "Rookie",
            	"description": "Reach Level 2.",
            	"condition": { "type": "level", "value": 2 },
            	"reward": { "type": "xp", "value": 20 }
            },
            {
            	"id": "level_5",
            	"name": "Getting Serious",
            	"description": "Reach Level 5.",
            	"condition": { "type": "level", "value": 5 },
            	"reward": { "type": "temp_xp_multiplier", "value": 1.5 }
            },
            {
            	"id": "level_10",
            	"name": "Level Climber",
            	"description": "Reach Level 10.",
            	"condition": { "type": "level", "value": 10 },
            	"reward": { "type": "temp_discount", "value": 0.05 }
            },
            {
            	"id": "level_20",
            	"name": "Dedicated",
            	"description": "Reach Level 20.",
            	"condition": { "type": "level", "value": 20 },
            	"reward": { "type": "temp_xp_multiplier", "value": 2 }
            },
            {
            	"id": "level_25",
            	"name": "Veteran",
            	"description": "Reach Level 25.",
            	"condition": { "type": "level", "value": 25 },
            	"reward": { "type": "xp", "value": 500 }
            },
            {
            	"id": "level_30",
            	"name": "Resilient",
            	"description": "Reach Level 30.",
            	"condition": { "type": "level", "value": 30 },
            	"reward": { "type": "temp_discount", "value": 0.1 }
            },
            {
            	"id": "level_40",
            	"name": "Experienced",
            	"description": "Reach Level 40.",
            	"condition": { "type": "level", "value": 40 },
            	"reward": { "type": "temp_xp_multiplier", "value": 3 }
            },
            {
            	"id": "level_50",
            	"name": "RPG Legend",
            	"description": "Reach Level 50.",
            	"condition": { "type": "level", "value": 50 },
            	"reward": { "type": "temp_xp_multiplier", "value": 5 }
            },
            {
            	"id": "level_50",
            	"name": "RPG Legend",
            	"description": "Reach Level 50.",
            	"condition": { "type": "level", "value": 50 },
            	"reward": { "type": "title", "value": "Legendary Hero" }
            },	
            {
            	"id": "level_60",
            	"name": "Battle-Hardened",
            	"description": "Reach Level 60.",
            	"condition": { "type": "level", "value": 60 },
            	"reward": { "type": "temp_discount", "value": 0.15 }
            },
            {
            	"id": "level_70",
            	"name": "Master Adventurer",
            	"description": "Reach Level 70.",
            	"condition": { "type": "level", "value": 70 },
            	"reward": { "type": "temp_xp_multiplier", "value": 4 }
            },
            {
            	"id": "level_80",
            	"name": "Grandmaster",
            	"description": "Reach Level 80.",
            	"condition": { "type": "level", "value": 80 },
            	"reward": { "type": "temp_discount", "value": 0.2 }
            },
            {
            	"id": "level_90",
            	"name": "Elite",
            	"description": "Reach Level 90.",
            	"condition": { "type": "level", "value": 90 },
            	"reward": { "type": "temp_xp_multiplier", "value": 5 }
            },
            {
            	"id": "level_100",
            	"name": "Centurion",
            	"description": "Reach Level 100.",
            	"condition": { "type": "level", "value": 100 },
            	"reward": { "type": "title", "value": "The Unyielding" }
            },
            {
            	"id": "level_100_Reward",
            	"name": "Centurion's Bounty",
            	"description": "Reach Level 100.",
            	"condition": { "type": "level", "value": 100 },
            	"reward": { "type": "points", "value": 10000 }
            },	
            {
            	"id": "level_500",
            	"name": "The Eternal",
            	"description": "Reach Level 500.",
            	"condition": { "type": "level", "value": 500 },
            	"reward": { "type": "perm_discount", "value": 0.25 }
            },
            {
            	"id": "level_500",
            	"name": "The Gift of Eternity",
            	"description": "Reach Level 500.",
            	"condition": { "type": "level", "value": 500 },
            	"reward": { "type": "points", "value": 100000 }
            },	
            {
            	"id": "level_1000",
            	"name": "Immortal Legend",
            	"description": "Reach Level 1000.",
            	"condition": { "type": "level", "value": 1000 },
            	"reward": { "type": "perm_discount", "value": 0.5 }
            },
            {
            	"id": "level_1000",
            	"name": "The Reward for Persistance",
            	"description": "Reach Level 1000.",
            	"condition": { "type": "level", "value": 1000 },
            	"reward": { "type": "points", "value": 10000000 }
            },
            {
            	"id": "point_collector_1",
            	"name": "Novice Worker",
            	"description": "Earn 1,000 points",
            	"condition": { "type": "point_collected", "value": 1000 },
            	"reward": { "type": "xp", "value": 100 }
            },
            {
            	"id": "point_collector_2",
            	"name": "Diligent Earner",
            	"description": "Earn 5,000 points",
            	"condition": { "type": "point_collected", "value": 5000 },
            	"reward": { "type": "xp", "value": 250 }
            },
            {
            	"id": "point_collector_3",
            	"name": "Wealthy",
            	"description": "Earn 10,000 points",
            	"condition": { "type": "point_collected", "value": 10000 },
            	"reward": { "type": "title", "value": "Wealthy" }
            },
            {
            	"id": "point_collector_4",
            	"name": "Treasure Hunter",
            	"description": "Earn 25,000 points",
            	"condition": { "type": "point_collected", "value": 25000 },
            	"reward": { "type": "perm_discount", "value": 0.05 }
            },
            {
            	"id": "point_collector_5",
            	"name": "Master of Fortune",
            	"description": "Earn 50,000 points",
            	"condition": { "type": "point_collected", "value": 50000 },
            	"reward": { "type": "perm_xp_multiplier", "value": 1.1 }
            },
            {
            	"id": "point_collector_6",
            	"name": "King of Gold",
            	"description": "Earn 100,000 points",
            	"condition": { "type": "point_collected", "value": 100000 },
            	"reward": { "type": "item", "value": "Token of Immense Wealth" }
            },
            {
            	"id": "point_collector_7",
            	"name": "Millionaire",
            	"description": "Earn 1,000,000 points",
            	"condition": { "type": "point_collected", "value": 1000000 },
            	"reward": { "type": "title", "value": "The Untouchable" }
            },
            {
            	"id": "first_purchase",
            	"name": "First Investment",
            	"description": "Buy your first item from the store",
            	"condition": { "type": "items_purchased", "value": 1 },
            	"reward": { "type": "xp", "value": 50 }
            },
            {
            	"id": "shopaholic",
            	"name": "Shopaholic",
            	"description": "Buy 10 items from the store",
            	"condition": { "type": "items_purchased", "value": 10 },
            	"reward": { "type": "xp", "value": 100 }
            },
            {
            	"id": "retail_therapy",
            	"name": "Retail Therapy",
            	"description": "Buy 50 items from the store",
            	"condition": { "type": "items_purchased", "value": 50 },
            	"reward": { "type": "title", "value": "Big Spender" }
            },
            {
            	"id": "ultimate_consumer",
            	"name": "Ultimate Consumer",
            	"description": "Buy a total of 100,000 items from the store",
            	"condition": { "type": "items_purchased", "value": 100000 },
            	"reward": { "type": "title", "value": "The Mogul" }
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
