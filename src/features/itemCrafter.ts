import { App, Modal, DropdownComponent, ButtonComponent, SliderComponent, Notice, Setting } from 'obsidian';
import GamifyPlugin from '../main';
import * as fs from 'fs';
import * as path from 'path';
import { StoreItem } from './itemStore';
import { EffectType, EffectParams } from '../features/effectService';

export class ItemCrafterModal extends Modal {
    private plugin: GamifyPlugin;
    private baseCost: number = 50;
    private effectsConfig = {
        boost: {
            maxXP: 2000,
            conversionRate: 4,
            discountThresholds: [
                { threshold: 800, multiplier: 0.9 },
                { threshold: 1200, multiplier: 0.8 },
                { threshold: 1600, multiplier: 0.7 } 
            ]
        },
        ritual: {
            maxMultiplier: 5,
            maxDuration: 180, // in hours
            costScaleFactor: 250,
            effectTypes: [
                { value: 'xp_multiplier', label: 'XP Multiplier' },
                { value: 'store_discount', label: 'Store Discount' },
                { value: 'points_boost', label: 'Points Boost' }
            ]
        },
        artifact: {
            effectTypes: [
                { value: 'unlock_title', label: 'Custom Title' },
                { value: 'skill_boost', label: 'Skill Boost' },
                { value: 'item', label: 'Item' },
                { value: 'custom', label: 'Custom Effect' }
            ],
            maxCustomLength: 500
        },
        cosmetic: {
            effectTypes: [
                { value: 'title', label: 'Cosmetic Title' }
            ]
        }
    };
    
    constructor(app: App, plugin: GamifyPlugin) {
        super(app);
        this.plugin = plugin;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('gamify-item-crafter-modal');
        
        contentEl.createEl('h2', { 
            text: 'Item Crafter', 
            cls: 'gamify-modal-title' 
        });
        
        const nameInput = this.createTextInput(contentEl, 'Item Name:', true, {
            required: true,
            maxLength: 50,
            validators: [
                value => value.trim().length > 2 || 'Name must be at least 3 characters'
            ]
        });
        
        const descInput = this.createTextArea(contentEl, 'Description:', true, {
            required: true,
            maxLength: 300,
            validators: [
                value => value.trim().length > 10 || 'Description must be at least 10 characters'
            ]
        });
        
        const categoryDropdown = new DropdownComponent(contentEl);
        this.populateCategoryDropdown(categoryDropdown);
        
        const effectContainer = contentEl.createDiv('gamify-effect-container');
        const effectInfoDiv = contentEl.createDiv('gamify-effect-info');
        
        categoryDropdown.onChange(category => {
            effectContainer.empty();
            effectInfoDiv.empty();
            this.renderEffectDetails(category, effectContainer, effectInfoDiv);
        });
        
        const requirementsSection = contentEl.createDiv('gamify-requirements-section');
        requirementsSection.createEl('h3', { text: 'Item Requirements' });
        
        const levelReqInput = this.createNumberInput(requirementsSection, 'Level Required:', false, 0, 50, 0);
        
        const skillReqContainer = requirementsSection.createDiv('gamify-skill-req-container');
        const skillDropdown = new DropdownComponent(skillReqContainer);
        skillDropdown.addOption('none', 'No Skill Required');
        
        // Populate skills from player data
        this.plugin.statCardData.skills.forEach(skill => {
            skillDropdown.addOption(skill.id, skill.name);
        });
        
        const skillLevelInput = this.createNumberInput(skillReqContainer, 'Required Skill Level:', false, 1, 20, 1);
        
        const costSection = contentEl.createDiv('gamify-cost-section');
        const maxCostInput = this.createNumberInput(costSection, 'Max Spending Limit (Tokens):', true, 10, 10000, 500);
               
        const storageOptions = new Setting(contentEl)
            .setName('Item Storage')
            .setDesc('Choose how you want to save the created item');
        
        const saveLocationDropdown = new DropdownComponent(storageOptions.controlEl);
        saveLocationDropdown.addOptions({
            'existing': 'Add to Existing Inventory',
            'separate': 'Create Standalone Item File'
        });
        
        const createButton = new ButtonComponent(contentEl)
            .setButtonText('Forge Custom Item')
            .setCta()
            .onClick(() => this.validateAndConfirmCreation(
                nameInput.value, 
                descInput.value, 
                categoryDropdown.getValue(),
                effectContainer,
                parseInt(maxCostInput.value),
                saveLocationDropdown.getValue(),
                parseInt(levelReqInput.value) || 0,
                skillDropdown.getValue() !== 'none' ? 
                    { skillId: skillDropdown.getValue(), level: parseInt(skillLevelInput.value) || 1 } : 
                    undefined
            ));
    }
    
    private populateCategoryDropdown(dropdown: DropdownComponent) {
        dropdown.addOption('none', ' ');
        dropdown.addOption('boost', 'XP Boost');
        dropdown.addOption('ritual', 'Ritual Effect');
        dropdown.addOption('artifact', 'Artifact');
        dropdown.addOption('cosmetic', 'Cosmetic');
    }
    
    private updateCostPreview(value: number, display: HTMLElement) {
        const creationFactor = Math.exp(value / 25);
        display.innerHTML = `
            <strong>Cost Distribution Preview:</strong><br>
            • Item Cost Factor: ${(2 - creationFactor).toFixed(2)}x<br>
            • Creation Cost Factor: ${creationFactor.toFixed(2)}x
        `;
    }
    
    private renderEffectDetails(
        category: string, 
        container: HTMLElement, 
        infoContainer: HTMLElement
    ) {
        switch (category) {
            case 'boost':
                const xpInput = this.createNumberInput(
                    container, 
                    'XP Amount:', 
                    true, 
                    0, 
                    this.effectsConfig.boost.maxXP
                );
                
                infoContainer.createEl('small', { 
                    text: `Max XP: ${this.effectsConfig.boost.maxXP}, Conversion Rate: 1:${this.effectsConfig.boost.conversionRate}` 
                });
                break;
            
            case 'ritual':
                const effectTypeDropdown = new DropdownComponent(container);
                container.createEl('span', { text: 'Effect Type:', cls: 'setting-item-label' });
                
                this.effectsConfig.ritual.effectTypes.forEach(effect => {
                    effectTypeDropdown.addOption(effect.value, effect.label);
                });
                
                const multiplierInput = this.createNumberInput(
                    container, 
                    'Effect Value:', 
                    true, 
                    1, 
                    this.effectsConfig.ritual.maxMultiplier,
                    1.5
                );
                
                const durationInput = this.createNumberInput(
                    container, 
                    'Duration (hours):', 
                    true, 
                    1, 
                    this.effectsConfig.ritual.maxDuration,
                    24
                );
                
                infoContainer.createEl('small', { 
                    text: `Max Value: ${this.effectsConfig.ritual.maxMultiplier}, Max Duration: ${this.effectsConfig.ritual.maxDuration} hours` 
                });
                break;
            
            case 'artifact':
                const artifactEffectDropdown = new DropdownComponent(container);
                container.createEl('span', { text: 'Artifact Effect:', cls: 'setting-item-label' });
                
                this.effectsConfig.artifact.effectTypes.forEach(effect => {
                    artifactEffectDropdown.addOption(effect.value, effect.label);
                });
                
                const secondaryFieldContainer = container.createDiv('secondary-effect-fields');
                
                artifactEffectDropdown.onChange(effectType => {
                    secondaryFieldContainer.empty();
                    
                    switch (effectType) {
                        case 'unlock_title':
                            this.createTextInput(secondaryFieldContainer, 'Title ID:', true, {
                                required: true,
                                placeholder: 'unique_title_id'
                            });
                            this.createTextInput(secondaryFieldContainer, 'Title Name:', true, {
                                required: true,
                                placeholder: 'Master Crafter'
                            });
                            this.createTextArea(secondaryFieldContainer, 'Title Description:', true, {
                                required: true,
                                placeholder: 'Earned through item creation mastery'
                            });
                            break;
                            
                        case 'skill_boost':
                            const skillSelect = new DropdownComponent(secondaryFieldContainer);
                            secondaryFieldContainer.createEl('span', { text: 'Skill to Boost:', cls: 'setting-item-label' });
                            
                            this.plugin.statCardData.skills.forEach(skill => {
                                skillSelect.addOption(skill.id, skill.name);
                            });
                            
                            this.createNumberInput(secondaryFieldContainer, 'Levels to Add:', true, 1, 5, 1);
                            break;

                        case 'item':
                            this.createTextArea(
                                secondaryFieldContainer, 
                                'Custom Effect Code:', 
                                true, 
                                {
                                    maxLength: this.effectsConfig.artifact.maxCustomLength,
                                    placeholder: 'Example: new Notice("Custom effect activated!");\nplugin.statCardData.points += 10;'
                                }
                            );
                            break;
						
                        case 'custom':
                            this.createTextArea(
                                secondaryFieldContainer, 
                                'Custom Effect Code:', 
                                true, 
                                {
                                    maxLength: this.effectsConfig.artifact.maxCustomLength,
                                    placeholder: 'Example: new Notice("Custom effect activated!");\nplugin.statCardData.points += 10;'
                                }
                            );
                            break;							
                    }
                });
                break;
                
            case 'cosmetic':
                const cosmeticTypeDropdown = new DropdownComponent(container);
                container.createEl('span', { text: 'Cosmetic Type:', cls: 'setting-item-label' });
                
                this.effectsConfig.cosmetic.effectTypes.forEach(effect => {
                    cosmeticTypeDropdown.addOption(effect.value, effect.label);
                });
                
                const titleNameInput = this.createTextInput(container, 'Title Name:', true, {
                    required: true,
                    placeholder: 'The Crafter'
                });
                
                const titleDescInput = this.createTextArea(container, 'Title Description:', true, {
                    required: true,
                    placeholder: 'What does this title signify'
                });
                break;
        }
    }
    
	private validateAndConfirmCreation(
		name: string, 
		description: string, 
		category: string, 
		effectContainer: HTMLElement, 
		maxCost: number,
		saveLocation: string,
		levelRequired: number = 0,
		skillRequired?: { skillId: string, level: number }
	) {
		if (!name || !description || category === 'none') {
			new Notice('Please fill in all required fields and select a category.');
			return;
		}
		
		// XP limit check for boost category:
		if (category === 'boost') {
			const xpInput = effectContainer.querySelector('input') as HTMLInputElement;
			const xpAmount = parseInt(xpInput.value);
			const maxAllowedXP = this.effectsConfig.boost.maxXP;
			const hasBypass = this.plugin.statCardData.ownedItems.includes('philosopher_stone') ||
				this.plugin.statCardData.titles.some(title => title.id === "alchemist");
			if (xpAmount > maxAllowedXP && !hasBypass) {
				new Notice(`XP exceeds the maximum allowed (${maxAllowedXP}). Possess a Philosopher’s Stone or have the alchemist title to bypass.`);
				return;
			}
		}
		
		// Check required crafting item exists:
		const requiredItems: Record<string, string> = {
			'boost': 'Experience Stone',
			'ritual': 'Ritual Gem',
			'artifact': 'Component',
			'cosmetic': 'Container'
		};
		if (requiredItems[category] && !this.plugin.statCardData.ownedItems.includes(requiredItems[category])) {
			new Notice(`Crafting a ${category} item requires a ${requiredItems[category]}.`);
			return;
		}
		
		// Calculate cost with effect multiplier adjustments:
		const finalCost = this.calculateCost(category, effectContainer, maxCost);
		const creationCost = Math.round(finalCost * 1.6);

		// Check spending limit against cost, with bypass for 'alkhest' or 'Creator' title:
		const hasCostBypass = this.plugin.statCardData.ownedItems.includes('alkhest') ||
			this.plugin.statCardData.titles.some(title => title.id === "Creator");
		if (maxCost < finalCost && !hasCostBypass) {
			new Notice('Insufficient limit. Offer an equivalent price.');
			return;
		}

		// Extract effects and proceed with confirmation
		const { effectType, effectParams } = this.extractEffects(category, effectContainer);
		this.showConfirmationModal(
			name, 
			description, 
			category, 
			finalCost, 
			creationCost, 
			effectType,
			effectParams,
			saveLocation,
			levelRequired,
			skillRequired
		);
	}

    private showConfirmationModal(
        name: string, 
        description: string, 
        category: string, 
        finalCost: number, 
        creationCost: number,
        effectType: EffectType,
        effectParams: EffectParams,
        saveLocation: string,
        levelRequired: number = 0,
        skillRequired?: { skillId: string, level: number }
    ) {
        const confirmModal = new Modal(this.app);
        confirmModal.contentEl.createEl('h3', { text: 'Confirm Item Creation' });
        confirmModal.contentEl.createEl('p', { text: `Item: ${name}` });
        confirmModal.contentEl.createEl('p', { text: `Category: ${category}` });
        confirmModal.contentEl.createEl('p', { text: `Effect Type: ${effectType}` });
        confirmModal.contentEl.createEl('p', { text: `Item Cost: ${finalCost} tokens` });
        confirmModal.contentEl.createEl('p', { text: `Creation Cost: ${creationCost} tokens` });
        
        if (levelRequired > 0) {
            confirmModal.contentEl.createEl('p', { text: `Level Required: ${levelRequired}` });
        }
        
        if (skillRequired) {
            const skill = this.plugin.statCardData.skills.find(s => s.id === skillRequired.skillId);
            const skillName = skill ? skill.name : skillRequired.skillId;
            confirmModal.contentEl.createEl('p', { text: `Requires ${skillName} Level ${skillRequired.level}` });
        }
        
        if (this.plugin.statCardData.points < creationCost) {
            confirmModal.contentEl.createEl('p', { 
                text: `Warning: You don't have enough tokens for creation (${this.plugin.statCardData.points}/${creationCost})`,
                cls: 'gamify-warning'
            });
        }
        
        new ButtonComponent(confirmModal.contentEl)
            .setButtonText('Confirm')
            .setCta()
            .onClick(() => {
                if (this.plugin.statCardData.points < creationCost) {
                    new Notice('Not enough tokens to create this item!');
                    return;
                }
                
                this.plugin.statCardData.points -= creationCost;
                
                this.createItem(
                    name, 
                    description, 
                    category, 
                    finalCost, 
                    creationCost, 
                    effectType,
                    effectParams,
                    saveLocation,
                    levelRequired,
                    skillRequired
                );
                
                confirmModal.close();
            });
        
        new ButtonComponent(confirmModal.contentEl)
            .setButtonText('Cancel')
            .onClick(() => confirmModal.close());
        
        confirmModal.open();
    }
    
    private extractEffects(category: string, container: HTMLElement): { effectType: EffectType, effectParams: EffectParams } {
        let effectType: EffectType;
        const effectParams: EffectParams = {};
        
        switch (category) {
            case 'boost':
                const xpInput = container.querySelector('input') as HTMLInputElement;
                const xpAmount = parseInt(xpInput.value);
                
                effectType = 'xp_boost';
                effectParams.value = xpAmount;
                break;
            
            case 'ritual':
                const typeDropdown = container.querySelector('select') as HTMLSelectElement;
                const valueInput = container.querySelectorAll('input')[0] as HTMLInputElement;
                const durationInput = container.querySelectorAll('input')[1] as HTMLInputElement;
                
                effectType = typeDropdown.value as EffectType;
                effectParams.value = parseFloat(valueInput.value);
                effectParams.duration = parseInt(durationInput.value);
                break;
            
            case 'artifact':
                const artifactEffectDropdown = container.querySelector('select') as HTMLSelectElement;
                effectType = artifactEffectDropdown.value as EffectType;
                
                const secondaryContainer = container.querySelector('.secondary-effect-fields');
                if (secondaryContainer) {
                    switch (effectType) {
                        case 'unlock_title':
                            const inputs = secondaryContainer.querySelectorAll('input');
                            const textArea = secondaryContainer.querySelector('textarea');
                            
                            if (inputs && inputs.length >= 2 && textArea) {
                                effectParams.titleId = inputs[0].value;
                                effectParams.titleName = inputs[1].value;
                                effectParams.titleDesc = textArea.value;
                            }
                            break;
                            
                        case 'skill_boost':
                            const skillDropdown = secondaryContainer.querySelector('select') as HTMLSelectElement;
                            const levelInput = secondaryContainer.querySelector('input') as HTMLInputElement;
                            
                            if (skillDropdown && levelInput) {
                                effectParams.skillId = skillDropdown.value;
                                effectParams.value = parseInt(levelInput.value);
                            }
                            break;
                            
                        case 'enable_feature':
                            const featureDropdown = secondaryContainer.querySelector('select') as HTMLSelectElement;
                            
                            if (featureDropdown) {
                                if (featureDropdown.value === 'custom') {
                                    const customInput = secondaryContainer.querySelector('input') as HTMLInputElement;
                                    effectParams.featureId = customInput ? customInput.value : '';
                                } else {
                                    effectParams.featureId = featureDropdown.value;
                                }
                            }
                            break;
                            
                        case 'custom':
                            const codeTextarea = secondaryContainer.querySelector('textarea') as HTMLTextAreaElement;
                            effectParams.customCode = codeTextarea ? codeTextarea.value : '';
                            break;
                            
                    }
                }
                break;
                
            case 'cosmetic':
                effectType = 'unlock_title';
                const titleNameInput = container.querySelectorAll('input')[0] as HTMLInputElement;
                const titleDescTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
                
                if (titleNameInput && titleDescTextarea) {
                    const uniqueId = `cosmetic_title_${Date.now()}`;
                    effectParams.titleId = uniqueId;
                    effectParams.titleName = titleNameInput.value;
                    effectParams.titleDesc = titleDescTextarea.value;
                }
                break;
                
            default:
                effectType = 'custom';
                break;
        }
        
        return { effectType, effectParams };
    }

	private calculateCost(category: string, container: HTMLElement, maxCost: number): number {
		let baseCost = this.baseCost;
		let effectMultiplier = 1; // default multiplier

		switch (category) {
			case 'boost':
				const xpInput = container.querySelector('input') as HTMLInputElement;
				const xpAmount = parseInt(xpInput.value);
				baseCost = xpAmount / this.effectsConfig.boost.conversionRate;
				// Apply discount thresholds:
				this.effectsConfig.boost.discountThresholds.forEach(threshold => {
					if (xpAmount >= threshold.threshold) {
						baseCost *= threshold.multiplier;
					}
				});
				// Increase cost with effect strength (if desired, you could change this logic)
				effectMultiplier = 1 + (xpAmount / this.effectsConfig.boost.maxXP);
				break;
				
			case 'ritual':
				const valueInput = container.querySelectorAll('input')[0] as HTMLInputElement;
				const durationInput = container.querySelectorAll('input')[1] as HTMLInputElement;
				baseCost = 200 + 
					parseFloat(valueInput.value) * this.effectsConfig.ritual.costScaleFactor + 
					(parseInt(durationInput.value) / 10 * 50);
				// Multiply cost with a factor based on the chosen effect value:
				effectMultiplier = parseFloat(valueInput.value);
				break;
				
			case 'artifact':
				baseCost = 500 + (maxCost / 2);
				// For artifacts, you might use a fixed multiplier or derive it from effect complexity:
				effectMultiplier = 1.2;
				break;
				
			case 'cosmetic':
				baseCost = 300;
				effectMultiplier = 1.1;
				break;
		}
		
		// Ensure the cost does not exceed the maxCost (unless bypassed later)
		return Math.min(Math.round(baseCost * effectMultiplier), maxCost);
	}
  
    private createItem(
        name: string, 
        description: string, 
        category: string, 
        cost: number, 
        creationCost: number,
        effectType: EffectType,
        effectParams: EffectParams,
        saveLocation: string,
        levelRequired: number = 0,
        skillRequired?: { skillId: string, level: number }
    ) {
        const newItem: StoreItem = {
            id: `custom_${category}_${Date.now()}`,
            name,
            description,
            cost,
            category: category as 'boost' | 'ritual' | 'artifact' | 'cosmetic',
            owned: false,
            levelRequired: levelRequired > 0 ? levelRequired : undefined,
            skillRequired: skillRequired,
            effectType: effectType,
            effectParams: effectParams,
            hidden: false
        };
        
        saveLocation === 'existing' 
            ? this.saveItemToInventory(newItem) 
            : this.saveItemToSeparateFile(newItem);
    }
    
    private saveItemToInventory(item: StoreItem) {
        try {
			const vaultPath = (this.app.vault.adapter as any).getBasePath();
			const folderPath = path.join(vaultPath, 'QuestLog', 'StoreInventory');
            const itemsFilePath = path.join(folderPath, 'items.json');
            let items: StoreItem[] = [];
            
            try {
                const existingContent = fs.readFileSync(itemsFilePath, 'utf8');
                items = JSON.parse(existingContent);
            } catch (error) {
                console.log('No existing items file found, creating new one');
            }
            
            items.push(item);
            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
            fs.writeFileSync(itemsFilePath, JSON.stringify(items, null, 4), 'utf8');
            
            new Notice(`Item "${item.name}" added to existing inventory!`);
            this.close();
        } catch (error) {
            console.error('Error saving item to inventory:', error);
            new Notice('Failed to create item. Check console for details.');
        }
    }
    
    private saveItemToSeparateFile(item: StoreItem) {
        try {
			const vaultPath = (this.app.vault.adapter as any).getBasePath();
			const folderPath = path.join(vaultPath, 'QuestLog', 'StoreInventory');
            const itemFilePath = path.join(folderPath, `${item.id}.json`);
            
            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
            fs.writeFileSync(itemFilePath, JSON.stringify(item, null, 4), 'utf8');
            
            new Notice(`Item "${item.name}" saved as a separate file!`);
            this.close();
        } catch (error) {
            console.error('Error saving item to separate file:', error);
            new Notice('Failed to create item file. Check console for details.');
        }
    }
    
    private createTextInput(
        container: HTMLElement, 
        label: string, 
        required: boolean = false,
        options: { 
            required?: boolean, 
            maxLength?: number, 
            defaultValue?: string,
            placeholder?: string,
            validators?: ((value: string) => string | true)[]
        } = {}
    ): HTMLInputElement {
        const setting = new Setting(container)
            .setName(label)
            .addText(text => {
                text.setValue(options.defaultValue || '');
                text.setPlaceholder(options.placeholder || `Enter ${label.toLowerCase()}`);
                
                const inputEl = text.inputEl;
                
                if (options.maxLength) {
                    inputEl.maxLength = options.maxLength;
                }
                
                if (required || options.required) {
                    inputEl.required = true;
                }
                
                return text;
            });
        
        return setting.controlEl.querySelector('input') as HTMLInputElement;
    }

    private createTextArea(
        container: HTMLElement, 
        label: string, 
        required: boolean = false,
        options: { 
            required?: boolean, 
            maxLength?: number, 
            defaultValue?: string,
            placeholder?: string,
            validators?: ((value: string) => string | true)[]
        } = {}
    ): HTMLTextAreaElement {
        const setting = new Setting(container)
            .setName(label)
            .addTextArea(text => {
                text.setValue(options.defaultValue || '');
                text.setPlaceholder(options.placeholder || `Enter ${label.toLowerCase()}`);
                
                const textAreaEl = text.inputEl;
                
                if (options.maxLength) {
                    textAreaEl.maxLength = options.maxLength;
                }
                
                if (required || options.required) {
                    textAreaEl.required = true;
                }
                
                return text;
            });
        
        return setting.controlEl.querySelector('textarea') as HTMLTextAreaElement;
    }
    
    private createNumberInput(
        container: HTMLElement, 
        label: string, 
        required: boolean = false,
        min: number = 0,
        max: number = Infinity,
        defaultValue: number = 0
    ): HTMLInputElement {
        const setting = new Setting(container)
            .setName(label)
            .addText(text => text
                .setValue(defaultValue.toString())
                .setPlaceholder(`Enter ${label.toLowerCase()}`)
                .then(input => {
                    input.inputEl.type = 'number';
                    input.inputEl.min = min.toString();
                    if (max !== Infinity) {
                        input.inputEl.max = max.toString();
                    }
                })
            );
        
        const input = setting.controlEl.querySelector('input') as HTMLInputElement;
        if (required) {
            input.setAttribute('required', 'true');
        }
        return input;
    }
}