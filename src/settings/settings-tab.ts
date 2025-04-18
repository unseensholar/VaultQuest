import { App, PluginSettingTab, Setting, Notice, Modal } from 'obsidian';
import GamifyPlugin from '../main';
import { DebugMenu } from '../debug/DebugMenu';
import { AchievementsService } from '../features/achievements';
import { NotificationListener, addNotificationSettingsUI } from '../support/notificationListener';

const difficultyLevels: { [key: string]: number } = {
    "Very Easy": 0,
    Easy: 0.001,
    Normal: 0.01,
    Hard: 0.025,
    "Very Hard": 0.05,
    Brutal: 0.1,
};

export class GamifySettingTab extends PluginSettingTab {
	plugin: GamifyPlugin;
    modelDropdown: HTMLSelectElement;
	achievementsService: AchievementsService;
	constructor(app: App, plugin: GamifyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.achievementsService = this.plugin.achievementsService;
	}

    private hasSystemControlAccess(): boolean {
        return this.plugin.statCardData.ownedItems && 
               this.plugin.statCardData.ownedItems.includes('system_control');
    }

    private hasTagAccess(): boolean {
        return this.plugin.statCardData.ownedItems && 
               this.plugin.statCardData.ownedItems.includes('tagger');
    }
	
    async display(): Promise<void> {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl).setName('Tracked Notes').setHeading();
		
		const trackedNotesContainer = containerEl.createDiv();
		
		if (this.plugin.settings.trackedNotes.length === 0) {
			trackedNotesContainer.createEl('p', {
				text: 'No notes are currently being tracked. Use the "Track Current Note for Tasks" command to start tracking notes.'
			});
		} else {
			const ul = trackedNotesContainer.createEl("ul", { cls: "gamify-tracked-notes" });

			this.plugin.settings.trackedNotes.forEach((path) => {
				const li = ul.createEl("li", { cls: "gamify-tracked-note" });
				li.createEl("span", { text: path });
				const removeButton = li.createEl("button", {
					text: "Remove",
					cls: "gamify-remove-button"
				});
				removeButton.addEventListener('click', async () => {
					this.plugin.settings.trackedNotes = this.plugin.settings.trackedNotes.filter(p => p !== path);
					await this.plugin.saveSettings();
					this.display();
				});
			});
		}
		
		new Setting(containerEl).setName('XP/Point Modifier').setHeading();
		
        if (!this.hasSystemControlAccess()) {
            const notice = containerEl.createEl('div', {
                cls: 'setting-item-description',
                text: 'You do not have permission to modify this settings.'
            });
        }		
		new Setting(containerEl)
	            .setName("Leveling Difficulty")
	            .setDesc("Adjust the XP scaling difficulty for leveling.")
	            .addDropdown((dropdown) => {
	                Object.keys(difficultyLevels).forEach((level) => {
	                    dropdown.addOption(level, level);
	                });
	
	                dropdown.setValue(
	                    Object.keys(difficultyLevels).find(
	                        (key) =>
	                            difficultyLevels[key] === this.plugin.settings.levelling_difficulty
	                    ) || "Hard"
	                );
	
	                dropdown.onChange(async (value) => {
	                    this.plugin.settings.levelling_difficulty = difficultyLevels[value];
	                    await this.plugin.saveSettings();
						let baseXp = 100;
						let NextuserLvl = this.plugin.statCardData.level+1;
						for (let i = 1; i < NextuserLvl; i++) {
							baseXp *= (1.1 + i * this.plugin.settings.levelling_difficulty);
						}					
						this.plugin.statCardData.nextLevelXp = Math.round(baseXp)
						await this.plugin.saveStatCardData()
	                });
	            });
			    
		new Setting(containerEl)
			.setName('XP per character')
			.setDesc('How much XP is earned for each character typed.')
			.addText(text => {
                text.setValue(this.plugin.settings.xpPerCharacter.toString());
                
                if (!this.hasSystemControlAccess()) {
                    text.setDisabled(true);
                    text.inputEl.title = "Permission Required.";
                } else {
                    text.onChange(async (value) => {
                        this.plugin.settings.xpPerCharacter = parseFloat(value) || 0.1;
                        await this.plugin.saveSettings();
                    });
                }
            });
		
		new Setting(containerEl)
			.setName('Base points value')
			.setDesc('Base points awarded for completing a task.')
			.addText(text => {
                text.setValue(this.plugin.settings.pointsBaseValue.toString());
                
                if (!this.hasSystemControlAccess()) {
                    text.setDisabled(true);
                    text.inputEl.title = "Permission Required.";
                } else {
                    text.onChange(async (value) => {
                        this.plugin.settings.pointsBaseValue = parseInt(value) || 10;
                        await this.plugin.saveSettings();
                    });
                }
            });

		new Setting(containerEl).setName('Tag Multipliers').setHeading();
				
        if (!(this.hasSystemControlAccess() || this.hasTagAccess())) {
            const notice = containerEl.createEl('div', {
                cls: 'setting-item-description',
                text: 'You do not have permission to modify this settings.'
            });
        }		
		Object.entries(this.plugin.settings.tagMultipliers).forEach(([tag, multiplier]) => {
			const setting = new Setting(containerEl)
				.setName(`Multiplier for ${tag}`)
				.setDesc(`Multiplier for tasks with the ${tag} tag.`)
				.addText(text => {
                    text.setValue(multiplier.toString());
                    
                    if (!(this.hasSystemControlAccess() || this.hasTagAccess())) {
                        text.setDisabled(true);
                        text.inputEl.title = "Permission Required.";
                    } else {
                        text.onChange(async (value) => {
                            this.plugin.settings.tagMultipliers[tag] = parseFloat(value) || 1.0;
                            await this.plugin.saveSettings();
                        });
                    }
                });
                
            if (this.hasSystemControlAccess() || !this.hasTagAccess()) {
                setting.addButton(button => button
                    .setButtonText('Remove')
                    .onClick(async () => {
                        delete this.plugin.settings.tagMultipliers[tag];
                        await this.plugin.saveSettings();
                        this.display();
                    }));
            }
		});
		
		if (this.hasSystemControlAccess() || !this.hasTagAccess()) {
			const newTagSetting = new Setting(containerEl)
				.setName('Add new tag multiplier')
				.setDesc('Add a new tag and its point multiplier.');

			let newTagInput: HTMLInputElement | null = null;
			let newMultiplierInput: HTMLInputElement | null = null;

			newTagSetting.addText(text => {
				text.setPlaceholder('#tag');
				text.setValue('');
				newTagInput = text.inputEl;
			});

			newTagSetting.addText(text => {
				text.setPlaceholder('multiplier');
				text.setValue('1.0');
				newMultiplierInput = text.inputEl;

				newMultiplierInput.addEventListener('input', () => {
					if (!this.hasSystemControlAccess()) {
						let value = parseFloat(newMultiplierInput!.value) || 1.0;
						if (value > 10) {
							newMultiplierInput!.value = '10';
						}
					}
				});
			});

			newTagSetting.addButton(button => button
				.setButtonText('Add')
				.onClick(async () => {
					if (newTagInput && newMultiplierInput) {
						const tag = newTagInput.value;
						let multiplier = parseFloat(newMultiplierInput.value) || 1.0;

						if (!this.hasSystemControlAccess() && multiplier > 10) {
							multiplier = 10;
							new Notice('Maximum tag multiplier limit is 10.');
						}

						const cost = multiplier * 10;

						if (this.plugin.statCardData.points >= cost) {
							if (tag && tag.startsWith('#')) {
								this.plugin.statCardData.points -= cost;
								this.plugin.settings.tagMultipliers[tag] = multiplier;
								await this.plugin.saveSettings();
								this.display();
								new Notice(`New tag added for ${cost} points!`);
							}
						} else {
							new Notice('Not enough points to add this tag!');
						}
					}
				}));
		}

		new Setting(containerEl).setName('Task Assessment').setHeading();

		new Setting(containerEl)
			.setName('Scan Completed Tasks')
			.setDesc('Find and assess all completed tasks that have not been logged.')
			.addButton(button => button
				.setButtonText('Scan Completed')
				.onClick(async () => {
					await this.plugin.taskAssessmentService.assessCompletedTasks();
				}));

		new Setting(containerEl)
			.setName("Scan Interval (minutes)")
			.setDesc("Set how often progress is saved and completed tasks are scanned.")
			.addDropdown(dropdown => {
				["1", "5", "10", "15", "30", "60"].forEach(value => {
					dropdown.addOption(value, `${value} minutes`);
				});

				dropdown.setValue(this.plugin.settings.scanInterval.toString());
				dropdown.onChange(async (value) => {
					this.plugin.settings.scanInterval = parseInt(value);
					await this.plugin.saveSettings();
					this.plugin.startPeriodicScanning(); 
				});
			});

		new Setting(containerEl)
			.setName('Deduct Points for Unchecking Tasks')
			.setDesc('When a completed task is unchecked, deduct the awarded points.')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.deductPointsForUnchecking);

				if (!this.hasSystemControlAccess()) {
					toggle.setDisabled(true);
					toggle.toggleEl.title = "Permission Required.";
				} else {
					toggle.onChange(async (value) => {
						this.plugin.settings.deductPointsForUnchecking = value;
						await this.plugin.saveSettings();
					});
				}
			});
				
		new Setting(containerEl).setName('LLM API').setHeading();
			
		new Setting(containerEl)
			.setName('API URL')
			.setDesc('URL of your local LLM API.')
			.addText(text => text
				.setValue(this.plugin.settings.apiUrl)
				.onChange(async (value) => {
					this.plugin.settings.apiUrl = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('API Key')
			.setDesc('API key for authentication (if required).')
			.addText(text => text
				.setValue(this.plugin.settings.apiKey)
				.setPlaceholder('your-api-key')
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));
				
        new Setting(containerEl)
            .setName('Test Connection')
            .setDesc('Test the connection to your LLM API.')
            .addButton(button => button
                .setButtonText('Test Connection')
                .onClick(async () => {
                    const connectionTest = await this.plugin.testConnection();
                    
                    if (connectionTest) {
                        new Notice('Connection successful!');
                        
                        const models = await this.plugin.fetchAvailableModels();
                        this.plugin.availableModels = models;
                        
                        this.updateModelDropdown();
                    } else {
                        new Notice('Connection failed. Please check your API URL and key.');
                    }
                }));
        
        const modelSetting = new Setting(containerEl)
            .setName('LLM Model')
            .setDesc('Select which LLM model to use for task assessment.');
            
        this.modelDropdown = document.createElement('select');
        this.modelDropdown.classList.add('dropdown');
        this.modelDropdown.value = this.plugin.settings.selectedLLMModel;
        this.modelDropdown.addEventListener('change', async () => {
            this.plugin.settings.selectedLLMModel = this.modelDropdown.value;
            await this.plugin.saveSettings();
        });
        
        const defaultOption = document.createElement('option');
        defaultOption.value = this.plugin.settings.selectedLLMModel;
        defaultOption.text = this.plugin.settings.selectedLLMModel;
        this.modelDropdown.appendChild(defaultOption);

        modelSetting.controlEl.appendChild(this.modelDropdown);
		
        new Setting(containerEl)
            .setName("Enable LLM")
            .setDesc("Turn on LLM-powered features.")
            .addToggle(toggle => 
                toggle
                    .setValue(this.plugin.settings.LLM_param.enabled)
                    .onChange(async (value) => {
                        this.plugin.settings.LLM_param.enabled = value;
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );

        if (this.plugin.settings.LLM_param.enabled) {
            const llmSettingsContainer = containerEl.createDiv({ cls: "llm-settings-container" });

			new Setting(llmSettingsContainer)
				.setName("Temperature")
				.setDesc("Controls randomness of LLM responses (0 = deterministic, 1 = very random).")
				.addText(text => 
					text
						.setPlaceholder("0.7")
						.setValue(this.plugin.settings.LLM_param.temp.toString())
						.onChange(async (value) => {
							const parsedValue = parseFloat(value); 
							if (!isNaN(parsedValue)) {
								this.plugin.settings.LLM_param.temp = parsedValue;
								await this.plugin.saveSettings();
							}
						})
				);


            new Setting(llmSettingsContainer)
                .setName("Max Tokens")
                .setDesc("Set the maximum number of tokens the LLM should generate per request.")
                .addText(text => 
                    text
                        .setPlaceholder("300")
						.setDisabled(true)
                        .setValue(this.plugin.settings.LLM_param.max_tokens.toString())
                        .onChange(async (value) => {
                            const parsedValue = parseInt(value);
                            if (!isNaN(parsedValue)) {
                                this.plugin.settings.LLM_param.max_tokens = parsedValue;
                                await this.plugin.saveSettings();
                            }
                        })
                );

            new Setting(llmSettingsContainer)
                .setName("Enable Streaming")
                .setDesc("Stream LLM responses in real-time.")
                .addToggle(toggle => 
                    toggle
                        .setValue(this.plugin.settings.LLM_param.stream)
						.setDisabled(true)
                        .onChange(async (value) => {
                            this.plugin.settings.LLM_param.stream = value;
                            await this.plugin.saveSettings();
                        })
                );
        }		

		new Setting(containerEl)
			.setName('Enable Rate Limiting')
			.setDesc('Limit the rate of requests to the LLM API to avoid issues.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.rateLimiting.enabled)
				.onChange(async (value) => {
					this.plugin.settings.rateLimiting.enabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Requests Per Minute')
			.setDesc('Maximum number of requests to send per minute (1-60).')
			.addSlider(slider => slider
				.setLimits(1, 60, 1)
				.setValue(this.plugin.settings.rateLimiting.requestsPerMinute)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.rateLimiting.requestsPerMinute = value;
					await this.plugin.saveSettings();
				}));		
		
		
		new Setting(containerEl).setName('Support').setHeading();
		
        new Setting(containerEl)
            .setName('Task Scan Button')
            .setDesc('Toggle the Task Scan button in the ribbon')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ribbonButtons.taskScan)
                .onChange(async (value) => {
                    this.plugin.settings.ribbonButtons.taskScan = value;
                    await this.plugin.saveSettings();
                    this.plugin.ribbonManager.updateRibbonIcons();
                }));

        new Setting(containerEl)
            .setName('Inventory Button')
            .setDesc('Toggle the Inventory button in the ribbon')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ribbonButtons.inventory)
                .onChange(async (value) => {
                    this.plugin.settings.ribbonButtons.inventory = value;
                    await this.plugin.saveSettings();
                    this.plugin.ribbonManager.updateRibbonIcons();
                }));

        new Setting(containerEl)
            .setName('Store Button')
            .setDesc('Toggle the Store button in the ribbon')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ribbonButtons.store)
                .onChange(async (value) => {
                    this.plugin.settings.ribbonButtons.store = value;
                    await this.plugin.saveSettings();
                    this.plugin.ribbonManager.updateRibbonIcons();
                }));

        new Setting(containerEl)
            .setName('Request Button')
            .setDesc('Toggle the Request button in the ribbon')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ribbonButtons.request)
                .onChange(async (value) => {
                    this.plugin.settings.ribbonButtons.request = value;
                    await this.plugin.saveSettings();
                    this.plugin.ribbonManager.updateRibbonIcons();
                }));

        new Setting(containerEl)
            .setName('Achievements Button')
            .setDesc('Toggle the Achievements button in the ribbon')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ribbonButtons.achievements)
                .onChange(async (value) => {
                    this.plugin.settings.ribbonButtons.achievements = value;
                    await this.plugin.saveSettings();
                    this.plugin.ribbonManager.updateRibbonIcons();
                }));

        new Setting(containerEl)
            .setName('Refresh Button')
            .setDesc('Toggle the Refresh UI button in the ribbon')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ribbonButtons.refresh)
                .onChange(async (value) => {
                    this.plugin.settings.ribbonButtons.refresh = value;
                    await this.plugin.saveSettings();
                    this.plugin.ribbonManager.updateRibbonIcons();
                }));

        new Setting(containerEl)
            .setName('Reload Plugin Button')
            .setDesc('Toggle the Reload Plugin button in the ribbon')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ribbonButtons.reload)
                .onChange(async (value) => {
                    this.plugin.settings.ribbonButtons.reload = value;
                    await this.plugin.saveSettings();
                    this.plugin.ribbonManager.updateRibbonIcons();
                }));

        new Setting(containerEl)
            .setName('Settings Button')
            .setDesc('Toggle the Settings button in the ribbon')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ribbonButtons.settings)
                .onChange(async (value) => {
                    this.plugin.settings.ribbonButtons.settings = value;
                    await this.plugin.saveSettings();
                    this.plugin.ribbonManager.updateRibbonIcons();
                }));
		
		new Setting(containerEl).setName('Notification Logging').setHeading();
		
		addNotificationSettingsUI(
			containerEl, 
			this.plugin, 
			this.plugin.notificationListener, 
			this.plugin.settings.notification, 
			async () => await this.plugin.saveSettings()
		);	

		new Setting(containerEl).setName('Data Reset').setHeading();
			
		new Setting(containerEl)
			.setName('Reset Completed Tasks')
			.setDesc('Clear the list of completed tasks.')
			.addButton(button => {
                button.setButtonText('Reset Task Completion Count')
                      .setWarning();
                if (!this.hasSystemControlAccess()) {
                    button.setDisabled(true);
                    button.buttonEl.title = "Permission Required.";
                } else {
                    button.onClick(async () => {
                        if (this.plugin.statCardData && this.plugin.statCardData.stats) {
                            const confirm = await new Promise(resolve => {
                                const modal = new ConfirmationModal(this.app, 
                                    "Reset Completed Tasks", 
                                    "Are you sure you want to reset completed tasks? This cannot be undone!", 
                                    resolve);
                                modal.open();
                            });
                        
                            if (confirm) {					
                                this.plugin.statCardData.stats.tasksCompleted = 0;
                                await this.plugin.saveStatCardData();
                                this.display();
                                new Notice('Task completion history has been reset.');
								this.plugin.statCardService.refreshUI();

                            }
                        } else {
                            new Notice('Stats data not available.');
                        }
                    });
                }
            });		
		
		new Setting(containerEl)
			.setName('Reset Progress')
			.setDesc('Warning: This will reset all your progress!')
			.addButton(button => button
				.setButtonText('Reset All Progress')
				.setWarning()
				.onClick(async () => {
					const confirm = await new Promise(resolve => {
						const modal = new ConfirmationModal(this.app, 
							"Reset Progress", 
							"Are you sure you want to reset all progress? This cannot be undone!", 
							resolve);
						modal.open();
					});
					
					if (confirm) {
						this.plugin.initializeDefaultStatCardData();
						await this.plugin.saveStatCardData();
						
						this.display();
						new Notice('All progress has been reset.');
						this.plugin.statCardService.refreshUI();

					}
				}));
		    containerEl.createEl('h2', {text: 'Debug Settings'});
    
		new Setting(containerEl)
			.setName('Enable Debug Mode')
			.setDesc('Enables debug features.')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.debugMode);
				
				if (!this.hasSystemControlAccess()) {
					toggle.setDisabled(true);
					toggle.toggleEl.title = "Permission Required.";
				} else {
					toggle.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.plugin.saveSettings();
					});
				}
			});
			
		if (this.plugin.settings.debugMode) {
			const debugDesc = containerEl.createEl('div', {
				cls: 'setting-item-description',
				text: 'Debug mode is enabled.'
			});
			
			if (this.plugin.hasDebugPermission()) {
				const openDebugBtn = containerEl.createEl('button', {
					text: 'Open Debug Menu',
					cls: 'mod-cta'
				});
				openDebugBtn.addEventListener('click', () => {
					new DebugMenu(this.app, this.plugin).open();
				});
			} else {
				const warningDiv = containerEl.createEl('div', {
					cls: 'setting-item-description',
					text: 'You need be a Debugger to access debug features.'
				});
			}
		}	
	}

    updateModelDropdown() {
        if (!this.modelDropdown) return;
        
        while (this.modelDropdown.firstChild) {
            this.modelDropdown.removeChild(this.modelDropdown.firstChild);
        }
        
        if (this.plugin.availableModels && this.plugin.availableModels.length > 0) {
            this.plugin.availableModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.text = model.id;
                
                if (model.id === this.plugin.settings.selectedLLMModel) {
                    option.selected = true;
                }
                
                this.modelDropdown.appendChild(option);
            });
            
            if (!this.plugin.availableModels.some(m => m.id === this.plugin.settings.selectedLLMModel)) {
                const option = document.createElement('option');
                option.value = this.plugin.settings.selectedLLMModel;
                option.text = this.plugin.settings.selectedLLMModel + " (not found)";
                option.selected = true;
                this.modelDropdown.appendChild(option);
            }
        } else {
            const option = document.createElement('option');
            option.value = this.plugin.settings.selectedLLMModel;
            option.text = this.plugin.settings.selectedLLMModel;
            this.modelDropdown.appendChild(option);
        }
    }
}


class ConfirmationModal extends Modal {
	result: (value: boolean) => void;
	message: string;
	
	constructor(app: App, title: string, message: string, result: (value: boolean) => void) {
		super(app);
		this.result = result;
		this.message = message;
	}
	
	onOpen() {
		const {contentEl} = this;
		
		contentEl.createEl("h2", {text: "Confirmation"});
		contentEl.createEl("p", {text: this.message});
		
		const buttonContainer = contentEl.createDiv();
		buttonContainer.addClass("modal-button-container");
		
		const cancelButton = buttonContainer.createEl("button", {text: "Cancel"});
		cancelButton.addEventListener("click", () => {
			this.result(false);
			this.close();
		});
		
		const confirmButton = buttonContainer.createEl("button", {text: "Confirm"});
		confirmButton.addClass("mod-warning");
		confirmButton.addEventListener("click", () => {
			this.result(true);
			this.close();
		});
	}
	
	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
