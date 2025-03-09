import { App, Notice, Modal, TFile, TextComponent, ButtonComponent, Vault } from 'obsidian';
import GamifyPlugin from './main';

export class StatCardService {
    private plugin: GamifyPlugin;
    private statusBarItem: HTMLElement | null = null;

    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
    }

    initializeUI() {

        this.plugin.addRibbonIcon('shield', 'Open Grimoire', (evt: MouseEvent) => {
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

export class LLMTaskService {
    private plugin: GamifyPlugin;
    private keyPressCount: number = 0;
    private lastFileCount: number = 0;
    private lastFolderCount: number = 0;
    private keyboardListener: (e: KeyboardEvent) => void;

    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
        
        // Initialize keyboard event listener
        this.keyboardListener = this.handleKeyPress.bind(this);
        document.addEventListener('keydown', this.keyboardListener);
        
        // Initialize file and folder counts
        this.updateFileFolderCounts();
        
        // Set up interval to check for changes in file/folder structure
        setInterval(() => this.updateFileFolderCounts(), 60000*5); // Check every 5 minutes - revisit
    }

    // Handle keyboard events to track writing skill
    private handleKeyPress(e: KeyboardEvent): void {

        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter') {
            this.keyPressCount++;
            

            if (this.keyPressCount >= 50) {
                this.updateWritingSkill(this.keyPressCount);
                this.keyPressCount = 0; // Reset counter logic needs work
            }
        }
    }

    // Count files and folders in the vault
    private async updateFileFolderCounts(): Promise<void> {
        const vault = this.plugin.app.vault;
        
        // Get all files in the vault - revisit
        const allFiles = vault.getFiles();
        const fileCount = allFiles.length;
        

        const folders = new Set<string>();
        allFiles.forEach(file => {
            const parentPath = file.parent?.path;
            if (parentPath && parentPath !== '/') {
                folders.add(parentPath);
            }
        });
        const folderCount = folders.size;
        

        if (fileCount !== this.lastFileCount) {
            this.updateResearchSkill(fileCount);
            this.lastFileCount = fileCount;
        }
        
        if (folderCount !== this.lastFolderCount) {
            this.updateOrganizationSkill(folderCount);
            this.lastFolderCount = folderCount;
        }
    }

    // Update writing skill based on keyboard activity
    private updateWritingSkill(keyCount: number): void {
        const skill = this.plugin.statCardData.skills.find(s => s.id === "writing");
        if (skill) {
            const xpGain = Math.floor(keyCount / 10); // 1 XP per 10 keystrokes
            this.updateSkill(skill, xpGain);
        }
    }

    // Update research skill based on file count
    private updateResearchSkill(fileCount: number): void {
        const skill = this.plugin.statCardData.skills.find(s => s.id === "research");
        if (skill) {
            // Base XP on file count milestones
            const xpGain = Math.floor(fileCount / 20); // 1 XP per 20 files
            this.updateSkill(skill, xpGain);
        }
    }

    // Update organization skill based on folder count
    private updateOrganizationSkill(folderCount: number): void {
        const skill = this.plugin.statCardData.skills.find(s => s.id === "organization");
        if (skill) {
            // Base XP on folder structure complexity
            const xpGain = Math.floor(folderCount / 5); // 1 XP per 5 folders
            this.updateSkill(skill, xpGain);
        }
    }

    // Common skill update logic
    private updateSkill(skill: any, xpAmount: number): void {
        if (xpAmount <= 0) return;
        

        skill.xp += xpAmount;
        

        const nextLevel = skill.level + 1;
        const xpForNextLevel = nextLevel * 25; // level up formula needs work
        
        if (skill.xp >= xpForNextLevel) {
            skill.level = nextLevel;
            skill.xp = 0;
            new Notice(`Your ${skill.name} skill has increased to level ${skill.level}!`);
            
            // Add points when leveling up skills
            this.plugin.statCardData.points += nextLevel * 2;
            

            this.plugin.saveStatCardData();
        }
    }

    async executeTask(instruction: string): Promise<string> {
        // First determine the cost of this request
        const pointsCost = await this.determineTaskCost(instruction);
        

        if (this.plugin.statCardData.points < pointsCost) {
            throw new Error(`Not enough points. You need ${pointsCost} points to perform this action.`);
        }

        try {
            // Deduct points before execution
            this.plugin.statCardData.points -= pointsCost;
            await this.plugin.saveStatCardData();

            // Prepare the LLM query with function calling - may need to be changed for other use cases - revisit
            const functions = [
                {
                    "name": "perform_task",
                    "description": "Perform a task requested by the user",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "result": {
                                "type": "string",
                                "description": "The result of the task execution"
                            },
                            "task_type": {
                                "type": "string",
                                "enum": ["answer", "code_execution", "analysis", "creative"],
                                "description": "The type of task performed"
                            },
                            "title": {
                                "type": "string",
                                "description": "A short title describing the task result"
                            }
                        },
                        "required": ["result"]
                    }
                }
            ];

            const messages = [
                {
                    "role": "system",
                    "content": "You are a powerful demonic entity that performs tasks for mortals who have spent their precious life force (points) to access your dark powers. You speak with a sinister, otherworldly tone and occasionally remind users of the price they've paid. You can answer questions, run simple code (by explaining the code and providing the expected output), analyze data, or provide creative content. Respond in markdown format when appropriate."
                },
                {
                    "role": "user",
                    "content": `I'd like you to perform this task: ${instruction}`
                }
            ];

            // Make the API call
            const response = await fetch(`${this.plugin.settings.apiUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.apiKey}`
                },
                body: JSON.stringify({
                    model: "local-model",
                    messages: messages,
                    tools: [{ "type": "function", "function": functions[0] }],
                    tool_choice: { "type": "function", "function": { "name": "perform_task" } }
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            
            // Extract the result from the response
            if (data.choices && data.choices[0] && data.choices[0].message && 
                data.choices[0].message.tool_calls && data.choices[0].message.tool_calls[0]) {
                
                const toolCall = data.choices[0].message.tool_calls[0];
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                // Save result to vault - revisit
                await this.saveResultToVault(functionArgs.result, functionArgs.title, pointsCost);
                
                return functionArgs.result;
            }
            
            throw new Error("Could not extract result from LLM response");
        } catch (error) {
            console.error("Error executing LLM task:", error);
            
            // Refund points if execution failed - probably need some other failsafe too
            this.plugin.statCardData.points += pointsCost;
            await this.plugin.saveStatCardData();
            
            throw error;
        }
    }
	public async determineTaskCost(instruction: string): Promise<number> {
        try {
            const functions = [
                {
                    "name": "determine_cost",
                    "description": "Determine the point cost for executing a task based on complexity",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "points": {
                                "type": "number",
                                "description": "The number of points required for the task"
                            },
                            "reasoning": {
                                "type": "string",
                                "description": "Explanation of how points were calculated"
                            },
                            "complexity": {
                                "type": "string",
                                "enum": ["trivial", "simple", "moderate", "complex", "extreme"],
                                "description": "Assessment of the task's complexity"
                            }
                        },
                        "required": ["points", "reasoning", "complexity"]
                    }
                }
            ];

            const messages = [
                {
                    "role": "system",
                    "content": "You are a demonic gatekeeper determining the cost for tasks. Assign points based on complexity: trivial (1-5 points), simple (5-10 points), moderate (10-30 points), complex (30-50 points), extreme (50-1000 points). Be fair but slightly menacing in your assessment."
                },
                {
                    "role": "user",
                    "content": `I request your dark powers for this task: "${instruction}". What is the cost?`
                }
            ];

            const response = await fetch(`${this.plugin.settings.apiUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.apiKey}`
                },
                body: JSON.stringify({
                    model: "local-model",
                    messages: messages,
                    tools: [{ "type": "function", "function": functions[0] }],
                    tool_choice: { "type": "function", "function": { "name": "determine_cost" } }
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.choices && data.choices[0] && data.choices[0].message && 
                data.choices[0].message.tool_calls && data.choices[0].message.tool_calls[0]) {
                
                const toolCall = data.choices[0].message.tool_calls[0];
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                return Math.round(functionArgs.points);
            }
            
            throw new Error("Could not determine task cost");
        } catch (error) {
            console.error("Error determining task cost:", error);
            // Fallback to default cost
            return 10;
        }
    }

    private async saveResultToVault(content: string, title: string, pointsCost: number): Promise<void> {
        try {

            const folderPath = 'VQ';
            const folder = this.plugin.app.vault.getAbstractFileByPath(folderPath);
            
            if (!folder) {
                await this.plugin.app.vault.createFolder(folderPath);
            }
            
            // Generate a unique filename with timestamp and random string
            const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
            const randomStr = Math.random().toString(36).substring(2, 8);
            const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
            const filename = `${folderPath}/${timestamp}_${safeTitle}_${randomStr}.md`;
            

            const fileContent = `---
title: ${title}
created: ${new Date().toISOString()}
points_cost: ${pointsCost}
---

# ${title}

${content} 

*the portal closes....*
`;
            

            await this.plugin.app.vault.create(filename, fileContent);
            
            new Notice(`Task result saved to ${filename}`);
        } catch (error) {
            console.error("Error saving result to vault:", error);
            new Notice("Error saving task result to vault.");
        }
    }
    

    public destroy(): void {
        document.removeEventListener('keydown', this.keyboardListener);
    }
}

export class RedeemTaskModal extends Modal {
    plugin: GamifyPlugin;
    instruction: string = '';
    
    constructor(app: App, plugin: GamifyPlugin) {
        super(app);
        this.plugin = plugin;
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        
        contentEl.createEl('h2', {text: 'Summon Demonic Powers'});
        
        contentEl.createEl('p', {
            text: `Points Available: ${this.plugin.statCardData.points}`
        });
        

        contentEl.createEl('label', {text: 'What do you wish to request from the darkness?'});
        
        const instructionInput = new TextComponent(contentEl)
            .setPlaceholder('e.g., "Write a blood-curdling tale of cosmic horror"')
            .onChange((value) => {
                this.instruction = value;
            });
        


        const inputEl = instructionInput.inputEl;
        inputEl.style.width = '100%';
        inputEl.style.height = '100px';
        

        const buttonContainer = contentEl.createDiv({cls: 'redeem-buttons'});
        
        new ButtonComponent(buttonContainer)
            .setButtonText('Flee')
            .onClick(() => {
                this.close();
                new StatCardModal(this.app, this.plugin).open();
            });
        
        new ButtonComponent(buttonContainer)
            .setButtonText('Summon')
            .setCta()
            .onClick(async () => {
                if (!this.instruction) {
                    new Notice('You must specify your desire.');
                    return;
                }
                
                try {
                    this.close();
                    new Notice('Summoning demonic powers...');
                    
                    const llmService = new LLMTaskService(this.plugin);
                    
                    // Get task cost first
                    const cost = await llmService.determineTaskCost(this.instruction);
                    
                    if (this.plugin.statCardData.points < cost) {
                        new Notice(`Not enough points. You need ${cost} points to perform this action.`);
                        new StatCardModal(this.app, this.plugin).open();
                        return;
                    }
                    
                    // Execute the task
                    const result = await llmService.executeTask(this.instruction);
                    
                    // Update UI
                    if (this.plugin.statCardService) {
                        this.plugin.statCardService.refreshUI();
                    }
                    
                    const resultModal = new TaskResultModal(this.app, this.plugin, result);
                    resultModal.open();
                } catch (error) {
                    console.error('Error executing task:', error);
                    new Notice(`The summoning failed. ${error.message}`);
                    new StatCardModal(this.app, this.plugin).open();
                }
            });
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

export class TaskResultModal extends Modal {
    plugin: GamifyPlugin;
    result: string;
    
    constructor(app: App, plugin: GamifyPlugin, result: string) {
        super(app);
        this.plugin = plugin;
        this.result = result;
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        
        contentEl.createEl('h2', {text: 'Dark Powers Response'});
        

        const resultContainer = contentEl.createDiv({cls: 'task-result-container'});
        resultContainer.style.maxHeight = '400px';
        resultContainer.style.overflow = 'auto';
        resultContainer.style.padding = '10px';
        resultContainer.style.border = '1px solid var(--background-modifier-border)';
        resultContainer.style.margin = '10px 0';
        

		const MarkdownIt = (window as any).markdownit;
        if (MarkdownIt) {
            const md = new MarkdownIt();
            resultContainer.innerHTML = md.render(this.result);
        } else {

            resultContainer.innerHTML = this.result.replace(/\n/g, '<br>');
        }
        

        const buttonContainer = contentEl.createDiv({cls: 'task-result-buttons'});
        
        new ButtonComponent(buttonContainer)
            .setButtonText('Return to Stat Card')
            .onClick(() => {
                this.close();
                new StatCardModal(this.app, this.plugin).open();
            });
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
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
        
        contentEl.createEl('h2', {text: 'Grimoire', cls: 'gamify-modal-title'});
        

        const statsContainer = contentEl.createDiv({cls: 'gamify-stats-container'});
        statsContainer.createEl('h3', {text: `Level ${this.plugin.statCardData.level} Soul Binder`, cls: 'gamify-stats-heading'});
        
        const xpBar = statsContainer.createDiv({cls: 'gamify-xp-bar'});
        const fillPercentage = Math.min(100, (this.plugin.statCardData.xp / this.plugin.statCardData.nextLevelXp) * 100);
        const xpBarFill = xpBar.createDiv({cls: 'gamify-xp-bar-fill'});
        xpBarFill.style.width = `${fillPercentage}%`;
        
        statsContainer.createEl('div', {
            text: `Soul Energy: ${Math.floor(this.plugin.statCardData.xp)}/${this.plugin.statCardData.nextLevelXp}`,
            cls: 'gamify-stat-item'
        });
        
        statsContainer.createEl('div', {
            text: `Demonic Tokens: ${this.plugin.statCardData.points}`,
            cls: 'gamify-stat-item'
        });
        

        const statsSection = contentEl.createDiv({cls: 'gamify-stats-details'});
        statsSection.createEl('h3', {text: 'Pact Details', cls: 'gamify-section-heading'});
        
        statsSection.createEl('div', {
            text: `Rituals Completed: ${this.plugin.statCardData.stats.tasksCompleted}`,
            cls: 'gamify-stat-item'
        });
        
        statsSection.createEl('div', {
            text: `Total Tokens Earned: ${this.plugin.statCardData.stats.totalPointsEarned}`,
            cls: 'gamify-stat-item'
        });
        

        const skillsSection = contentEl.createDiv({cls: 'gamify-skills-section'});
        skillsSection.createEl('h3', {text: 'Skills', cls: 'gamify-section-heading'});
        
        const skillsList = skillsSection.createEl('ul', {cls: 'gamify-skills-list'});
        for (const skill of this.plugin.statCardData.skills) {
            skillsList.createEl('li', {
                text: `${skill.name}: Level ${skill.level}`,
                cls: 'gamify-skill-item'
            });
        }
        

        const redeemSection = contentEl.createDiv({cls: 'gamify-redeem-section'});
        redeemSection.createEl('h3', {text: 'Summon Dark Powers', cls: 'gamify-section-heading'});
        
        const redeemButton = new ButtonComponent(redeemSection)
            .setButtonText('Make a Demonic Request')
            .onClick(() => {
                this.close();
                new RedeemTaskModal(this.app, this.plugin).open();
            });
        

        const buttonEl = redeemButton.buttonEl;
        buttonEl.addClass('gamify-summon-button');
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}