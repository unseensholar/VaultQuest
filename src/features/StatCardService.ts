import { App, Notice, Modal, ButtonComponent } from 'obsidian';
import GamifyPlugin from '../main';
import { ThemeSelectionModal } from '../features/themeService';
import { RedeemTaskModal } from '../core/CoreServices';

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
        
        this.renderHeader(contentEl, theme);
        this.renderCoreStats(contentEl, theme);
        this.renderSkills(contentEl, theme);
        this.renderTitles(contentEl);
        this.renderInventory(contentEl);
        this.renderActiveEffects(contentEl, theme);
        this.renderFamiliar(contentEl);
		this.renderSubStats(contentEl, theme);
        this.renderAchievements(contentEl);
    }
    
    private renderHeader(contentEl: HTMLElement, theme: any) {
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
    }
    
    private renderCoreStats(contentEl: HTMLElement, theme: any) {
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
        
        const statEl = statsContainer.createEl('div', { cls: 'gamify-stat-item' });
		statEl.createEl('strong', { text: `${theme.uiElements.xp}: ` });
		statEl.appendText(`${Math.floor(this.plugin.statCardData.xp)}/${this.plugin.statCardData.nextLevelXp}`);

		const summaryContainer = statsContainer.createDiv({cls: 'gamify-stats-grid'});

		const summaryEntries = [
            { label: `${theme.uiElements.tasksCompleted}`, value: `${this.plugin.statCardData.stats.tasksCompleted || 0}` },
            { label: `${theme.uiElements.points}`, value: `${this.plugin.statCardData.points || 0}` }
        ];
		
		summaryEntries.forEach(stat => {
			const statEl = summaryContainer.createDiv({ cls: 'gamify-stat-card' });
			statEl.createDiv({ cls: 'gamify-stat-label', text: stat.label });
			statEl.createDiv({ cls: 'gamify-stat-value', text: stat.value });
        });
    }
    
	private renderSubStats(contentEl: HTMLElement, theme: any) {
		const statsContainer = contentEl.createDiv({ cls: 'gamify-stats-container' });
		statsContainer.createEl('h3', { text: 'Sub Stats', cls: 'gamify-section-heading' });

		const statsGridContainer = statsContainer.createDiv({ cls: 'gamify-stats-grid' });
		const mainStats = [
			{ label: "File Count", value: `${this.plugin.statCardData?.stats?.lastFileCount || 0}` },
			{ label: "Folder Count", value: `${this.plugin.statCardData?.stats?.lastFolderCount || 0}` },
			{ label: "Characters Typed", value: this.plugin.statCardData?.writingStats?.totalCharactersTyped || 0 },
			{ label: "Highest Difficulty", value: this.plugin.statCardData?.stats?.highestDifficulty || 0 },
			{ label: `Total ${theme.uiElements.points} Earned`, value: `${this.plugin.statCardData.stats.totalPointsEarned || 0}` },
			{ label: "Total Items Purchased", value: this.plugin.statCardData?.stats?.itemsPurchased || 0 }
		];
		mainStats.forEach(stat => {
			const statCard = statsGridContainer.createDiv({ cls: 'gamify-stat-card' });
			statCard.createDiv({ cls: 'gamify-stat-label', text: `${stat.label}` });
			statCard.createDiv({ cls: 'gamify-stat-value', text: `${stat.value}` });
		});

		const streaksContainer = statsContainer.createDiv({ cls: 'gamify-streaks-grid' });
		const streakStats = [
			{ label: "Current Streak", value: this.plugin.statCardData?.streaks?.currentStreak || 0 },
			{ label: "Longest Streak", value: this.plugin.statCardData?.streaks?.longestStreak || 0 }
		];
		streakStats.forEach(streak => {
			const streakCard = streaksContainer.createDiv({ cls: 'gamify-stat-card streak-card' });
			streakCard.createDiv({ cls: 'gamify-stat-label', text: `${streak.label}` });
			streakCard.createDiv({ cls: 'gamify-stat-value', text: `${streak.value}` });
		});
	}

    	
	private renderSkills(contentEl: HTMLElement, theme: any) {
		const { skills } = this.plugin.statCardData;
		if (!skills || skills.length === 0) return;

		const skillsSection = contentEl.createDiv({ cls: 'gamify-skills-section' });
		skillsSection.createEl('h3', { text: theme.uiElements.skills, cls: 'gamify-section-heading' });

		const skillsContainer = skillsSection.createDiv({ cls: 'gamify-skills-container' });

		skills.forEach(skill => {
			const skillBlock = skillsContainer.createDiv({ cls: 'gamify-skill-block' });

			const skillTitle = skillBlock.createEl('h4', { text: skill.name, cls: 'gamify-skill-title' });
			const skillLevel = skillBlock.createEl('p', { text: `${skill.level}`, cls: 'gamify-skill-level' });
		});
	}

    private renderTitles(contentEl: HTMLElement) {
        if (!this.plugin.statCardData.titles || this.plugin.statCardData.titles.length === 0) return;
        
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
    
    private renderInventory(contentEl: HTMLElement) {
        if (!this.plugin.statCardData.items || this.plugin.statCardData.items.length === 0) return;
        
        const inventorySection = contentEl.createDiv({cls: 'gamify-inventory-section'});
        const inventoryHeader = inventorySection.createDiv({cls: 'gamify-section-header'});
        inventoryHeader.createEl('h3', {text: 'Items', cls: 'gamify-section-heading'});
        const inventoryContent = inventorySection.createDiv({cls: 'gamify-inventory-content'});
        const inventoryGrid = inventoryContent.createDiv({cls: 'gamify-inventory-grid'});
        
        for (const item of this.plugin.statCardData.items) {
            const rarityClass = this.getItemRarityClass(item.cost);
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
    
    private getItemRarityClass(itemCost: number | string): string {
        if (!itemCost) return 'common-item';
        
        const cost = typeof itemCost === 'string' ? parseInt(itemCost) : itemCost;
        
        if (cost >= 500) return 'legendary-item';
        if (cost >= 200) return 'unique-item';
        if (cost >= 50) return 'rare-item';
        return 'common-item';
    }
    
    private renderActiveEffects(contentEl: HTMLElement, theme: any) {
        if (!this.plugin.statCardData.activeEffects || 
            Object.keys(this.plugin.statCardData.activeEffects).length === 0) return;
        
        const effectsSection = contentEl.createDiv({cls: 'gamify-active-effects'});
        effectsSection.createEl('h4', {text: 'Active Effects'});
        
        const now = Date.now();
        
		for (const [key, effect] of Object.entries(this.plugin.statCardData.activeEffects)) {
			if (effect.expiresAt && effect.expiresAt > now) {
				let timeLeftMs = effect.expiresAt - now;
				let timeLeftStr = '';

				const seconds = Math.floor((timeLeftMs / 1000) % 60);
				const minutes = Math.floor((timeLeftMs / (1000 * 60)) % 60);
				const hours = Math.floor((timeLeftMs / (1000 * 60 * 60)) % 24);
				const days = Math.floor((timeLeftMs / (1000 * 60 * 60 * 24)) % 365);
				const years = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24 * 365));

				if (years > 0) {
					timeLeftStr = `${years} year${years > 1 ? 's' : ''}`;
					if (days > 0) timeLeftStr += `, ${days} day${days > 1 ? 's' : ''}`;
				} else if (days > 0) {
					timeLeftStr = `${days} day${days > 1 ? 's' : ''}`;
					if (hours > 0) timeLeftStr += `, ${hours} hour${hours > 1 ? 's' : ''}`;
				} else if (hours > 0) {
					timeLeftStr = `${hours} hour${hours > 1 ? 's' : ''}`;
					if (minutes > 0) timeLeftStr += `, ${minutes} min${minutes > 1 ? 's' : ''}`;
				} else if (minutes > 0) {
					timeLeftStr = `${minutes} min${minutes > 1 ? 's' : ''}`;
					if (seconds > 0) timeLeftStr += `, ${seconds} sec${seconds > 1 ? 's' : ''}`;
				} else {
					timeLeftStr = `${seconds} sec${seconds > 1 ? 's' : ''}`;
				}

				const effectEl = effectsSection.createDiv({ cls: 'gamify-effect-item' });

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

				effectEl.createEl('span', { text: `${effectName}: ${effectValue}` });
				effectEl.createEl('span', { text: ` (${timeLeftStr} remaining)` });
			}
		}

    }
    
    private renderFamiliar(contentEl: HTMLElement) {
        if (!this.plugin.statCardData.hasFamiliar) return;
        
        const familiarSection = contentEl.createDiv({cls: 'gamify-familiar-section'});
        familiarSection.createEl('h4', {text: 'Familiar'});
        familiarSection.createEl('p', {
            text: 'Your familiar is providing daily benefits.'
        });
    }
    
    private renderAchievements(contentEl: HTMLElement) {
        if (!this.plugin.statCardData.achievements || this.plugin.statCardData.achievements.length === 0) return;
        
        const achievementsSection = contentEl.createDiv({ cls: 'gamify-achievements-section' });
        achievementsSection.createEl('h3', { text: 'Achievements', cls: 'gamify-section-heading' });

        const achievementsList = achievementsSection.createEl('ul', { cls: 'gamify-achievements-list' });

        for (const achievement of this.plugin.statCardData.achievements) {
            const achievementItem = achievementsList.createEl('li', { cls: 'gamify-achievement-item' });
            
            const iconAndName = achievementItem.createEl('div', { cls: 'gamify-achievement-header' });
            iconAndName.createEl('strong', { text: achievement.name, cls: 'gamify-achievement-name' });
            
            const tooltip = achievementItem.createEl('span', { text: achievement.description, cls: 'gamify-achievement-tooltip' });
            
			achievementItem.addEventListener("mouseenter", () => {
				tooltip.addClass("gamify-tooltip-visible");
			});

			achievementItem.addEventListener("mouseleave", () => {
				tooltip.removeClass("gamify-tooltip-visible");
			});

            
            achievementItem.classList.add('gamify-glow');
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