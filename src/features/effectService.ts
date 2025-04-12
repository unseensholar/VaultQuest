import { Notice } from 'obsidian';
import GamifyPlugin from '../main';
import { StoreItem } from '../features/itemStore';

export type EffectType = 
    | 'xp_boost'
    | 'points_boost'
    | 'store_discount'
    | 'xp_multiplier'
    | 'skill_boost'
    | 'unlock_title'
    | 'enable_feature'
    | 'summon_familiar'
    | 'consumable_material'
    | 'custom';

export interface EffectParams {
    value?: number;
    duration?: number; // in hours
    skillId?: string;
    titleId?: string;
    titleName?: string;
    titleDesc?: string;
    featureId?: string;
    customCode?: string;
	materialId?: string; 
}

export class EffectService {
    private plugin: GamifyPlugin;
    private items: StoreItem[] = [];
    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
		
    }
    
    applyEffect(type: EffectType, params: EffectParams = {}): void {
        switch (type) {
            case 'xp_boost':
                this.applyXPBoost(params.value || 0);
                break;
            case 'points_boost':
                this.applyPointsBoost(params.value || 0);
                break;
            case 'store_discount':
                this.applyStoreDiscount(params.value || 0.1, params.duration || 24);
                break;
            case 'xp_multiplier':
                this.applyXPMultiplier(params.value || 1.5, params.duration || 24);
                break;
            case 'skill_boost':
                this.applySkillBoost(params.skillId || "", params.value || 1);
                break;
            case 'unlock_title':
                this.unlockTitle(params.titleId || "", params.titleName || "", params.titleDesc || "", params.featureId || "");
                break;
            case 'enable_feature':
                this.enableFeature(params.featureId || "");
                break;
            case 'summon_familiar':
                this.summonFamiliar();
                break;
			case 'consumable_material':
				this.applyConsumableMaterial(params.materialId || "", params.value || 1);
				break;				
            case 'custom':
                if (params.customCode) {
                    this.applyCustomEffect(params.customCode);
                }
                break;
        }
    }
    
    private applyXPBoost(amount: number): void {
        this.plugin.statCardData.xp += amount;
        new Notice(`Your soul absorbs ${amount} experience points!`);
    }
    
    private applyPointsBoost(amount: number): void {
        this.plugin.statCardData.points += amount;
        new Notice(`You've received ${amount} tokens!`);
    }
    
    private applyStoreDiscount(discountRate: number, durationHours: number): void {
        this.plugin.statCardData.activeEffects = this.plugin.statCardData.activeEffects || {};
        this.plugin.statCardData.activeEffects.storeDiscount = {
            value: discountRate,
            expiresAt: Date.now() + (durationHours * 60 * 60 * 1000)
        };
        
        const discountPercent = Math.round(discountRate * 100);
        new Notice(`All items are now ${discountPercent}% cheaper for ${durationHours} hours!`);
    }
    
    private applyXPMultiplier(multiplier: number, durationHours: number): void {
        this.plugin.statCardData.activeEffects = this.plugin.statCardData.activeEffects || {};
        this.plugin.statCardData.activeEffects.xpMultiplier = {
            value: multiplier,
            expiresAt: Date.now() + (durationHours * 60 * 60 * 1000)
        };
        
        new Notice(`You now gain ${multiplier}x XP for ${durationHours} hours!`);
    }
    
    private applySkillBoost(skillId: string, levels: number): void {
        const skill = this.plugin.statCardData.skills.find(s => s.id === skillId);
        if (skill) {
            skill.level += levels;
            new Notice(`Your ${skill.name} skill has increased by ${levels} level${levels > 1 ? 's' : ''}!`);
        } else {
            new Notice(`Error: Skill ${skillId} not found.`);
        }
    }
    
    private unlockTitle(titleId: string, titleName: string, titleDesc: string, effectId: string = ""): void {
        if (!this.plugin.statCardData.titles.some(title => title.id === titleId)) {
            const newTitle = {
                id: titleId,
                name: titleName,
                description: titleDesc,
                unlockedAt: new Date().toISOString(),
                effect: effectId ? [effectId] : []
            };
            
            this.plugin.statCardData.titles.push(newTitle);
            new Notice(`You've earned the "${titleName}" title!`);
        }
    }
    
    private enableFeature(featureId: string): void {
        switch (featureId) {
            case 'store_app':
                new Notice('You can now access the store from the inventory!');
                break;
            case 'theme_toggler':
                new Notice('You can now change themes from the stats menu!');
                break;
            case 'tagger':
                new Notice('You have been granted Tag editing rights!');
                break;
            case 'infinite_inventory':
                new Notice('You bought an Inventory Box!');
                break;
            default:
                new Notice(`Feature ${featureId} has been enabled!`);
        }
    }
    
    private summonFamiliar(): void {
        this.plugin.statCardData.hasFamiliar = true;
        this.setupFamiliarDailyBonus();
        new Notice('A small creature materializes, bound to your service!');
    }
    
    private setupFamiliarDailyBonus(): void {
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
        }
    }


	private applyConsumableMaterial(materialId: string, quantity: number = 1): void {
		if (!materialId) {
			console.error("No item ID provided for consumable material effect");
			new Notice("Error applying consumable material effect");
			return;
		}
		
		const regex = new RegExp(`^${materialId}(?:\\s+x(\\d+))?$`);
		let existingCount = 0;
		let existingItemName = '';

		for (const item of this.plugin.statCardData.ownedItems) {
			const match = item.match(regex);
			if (match) {
				existingItemName = materialId;
				existingCount = match[1] ? parseInt(match[1]) : 1;
				break;
			}
		}
		
		if (existingItemName) {
			const index = this.plugin.statCardData.ownedItems.indexOf(existingItemName);
			this.plugin.statCardData.ownedItems.splice(index, 1);
		}
		
		const newCount = existingCount + quantity;
		const newItemName = newCount > 1 ? `${materialId} x${newCount}` : materialId;
		this.plugin.statCardData.ownedItems.push(newItemName);
		new Notice(`You've received ${quantity} ${materialId}${quantity > 1 ? 's' : ''}! (Total: ${newCount})`);
	}   
	
	private applyCustomEffect(code: string): void {
		try {
			const plugin = this.plugin;
			const Notice = require('obsidian').Notice;
			const app = this.plugin.app;
			
			const execFunction = new Function('plugin', 'Notice', 'app', `
				try {
					${code}
				} catch (innerError) {
					console.error("Error in custom code:", innerError);
					new Notice("Error in custom code execution.");
				}
			`);
			
			execFunction(this.plugin, Notice, this.plugin.app);
		} catch (error) {
			console.error("Error executing custom effect:", error);
			const Notice = require('obsidian').Notice;
			new Notice("Error executing custom item effect.");
		}
	}
}
