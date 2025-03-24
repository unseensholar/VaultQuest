import { App, Notice, Modal, TextComponent, ButtonComponent } from 'obsidian';
import GamifyPlugin from '../main';
import { StatCardModal } from '../features/StatCardService';
import { ThemeService } from '../features/themeService';

export class LLMTaskService {
    private plugin: GamifyPlugin;
    private keyPressCount: number = 0;
    private keyboardListener: (e: KeyboardEvent) => void;
    private intervalId: number | null = null;

    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
        
        this.keyboardListener = this.handleKeyPress.bind(this);
        document.addEventListener('keydown', this.keyboardListener);
        
        this.updateFileFolderCounts();
        
        this.intervalId = window.setInterval(() => this.updateFileFolderCounts(), 60000*5); // Check every 5 minutes
    }

    private handleKeyPress(e: KeyboardEvent): void {
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter') {
            this.keyPressCount++;
            
            if (this.keyPressCount >= 50) {
                try {
                    this.updateWritingSkill(this.keyPressCount);
                    this.keyPressCount = 0;
                } catch (error) {
                    console.error("Error updating writing skill:", error);
                }
            }
        }
    }

    private async updateFileFolderCounts(): Promise<void> {
        try {
            const vault = this.plugin.app.vault;
            
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
            
            const previousFileCount = this.plugin.statCardData.stats.lastFileCount || 0;
            const previousFolderCount = this.plugin.statCardData.stats.lastFolderCount || 0;
                        
            if (fileCount !== previousFileCount) {
                this.plugin.statCardData.stats.lastFileCount = fileCount;        
                this.updateResearchSkill(fileCount);
            }
            
            if (folderCount !== previousFolderCount) {
                this.plugin.statCardData.stats.lastFolderCount = folderCount;
                this.updateOrganizationSkill(folderCount);
            }
        } catch (error) {
            console.error("Error updating file/folder counts:", error);
        }
    }

    private updateWritingSkill(keyCount: number): void {
        const skill = this.plugin.statCardData.skills.find(s => s.id === "writing");
        if (skill) {
            const xpGain = Math.floor(keyCount / 1);
            this.updateSkill(skill, xpGain);
        }
    }

    private getRequiredCountForLevel(level: number, baseCount: number, incrementFactor: number): number {
        let total = 0;
        for (let i = 1; i <= level; i++) {
            total += Math.floor(baseCount + (i - 1) * incrementFactor);
        }
        return total;
    }

    private getLevelForCount(count: number, baseCount: number, incrementFactor: number): { level: number, progress: number } {
        let level = 0;
        let totalRequired = 0;
        let prevTotalRequired = 0;
        
        while (true) {
            level++;
            prevTotalRequired = totalRequired;
            totalRequired += Math.floor(baseCount + (level - 1) * incrementFactor);
            
            if (totalRequired > count) {
                level--;
                const nextLevelCost = Math.floor(baseCount + (level) * incrementFactor);
                const remainingCount = count - prevTotalRequired;
                const progress = (remainingCount / nextLevelCost) * 100;
                return { level, progress };
            }
            
            if (totalRequired === count) {
                return { level, progress: 0 };
            }
        }
    }

    private updateResearchSkill(fileCount: number): void {
        const skill = this.plugin.statCardData.skills.find(s => s.id === "research");
        if (skill) {
            // Base: 5 files for level 1, +4 more files per level
            const result = this.getLevelForCount(fileCount, 5, 10);
            this.setSkillLevel(skill, result.level, result.progress);
        }
    }

    private updateOrganizationSkill(folderCount: number): void {
        const skill = this.plugin.statCardData.skills.find(s => s.id === "organization");
        if (skill) {
            // Base: 3 folders for level 1, +4 more folder per level
            const result = this.getLevelForCount(folderCount, 3, 4);
            this.setSkillLevel(skill, result.level, result.progress);
        }
    }

    private setSkillLevel(skill: any, newLevel: number, xpPercentage: number): void {
        const oldLevel = skill.level;
        skill.level = newLevel;
        skill.xp = Math.floor(xpPercentage);
        
        if (newLevel > oldLevel) {
            const pointsGained = (newLevel - oldLevel) * 2;
            this.plugin.statCardData.points += pointsGained;
            new Notice(`Your ${skill.name} skill has increased to level ${skill.level}!`);
        }
    }

    private updateSkill(skill: any, xpAmount: number): void {
        if (xpAmount <= 0) return;
        
        if (this.plugin.statCardData.activeEffects?.xpMultiplier) {
            const multiplier = this.plugin.statCardData.activeEffects.xpMultiplier;
            const now = Date.now();
            
            if (multiplier.expiresAt > now) {
                xpAmount = Math.floor(xpAmount * multiplier.value);
            }
        }
        
        skill.xp += xpAmount;
        
        const nextLevel = skill.level + 1;
        const xpForNextLevel = Math.floor(100 + 25 * nextLevel + Math.pow(nextLevel, 2) * 2);
        
        if (skill.xp >= xpForNextLevel) {
            skill.level = nextLevel;
            skill.xp = 0;
            new Notice(`Your ${skill.name} skill has increased to level ${skill.level}!`);
            
            this.plugin.statCardData.points += nextLevel * 2;
        }
    }

    async executeTask(instruction: string): Promise<string> {
        try {
            this.plugin.processingIndicatorService.startProcessing('llm');
            
            if (instruction.toLowerCase().includes("create theme") || 
                instruction.toLowerCase().includes("generate theme")) {
                return this.generateTheme(instruction);
            }

            const pointsCost = await this.determineTaskCost(instruction);
            new Notice(`${pointsCost} points will be expended for the task.`);

            if (this.plugin.statCardData.points < pointsCost) {
                throw new Error(`Not enough points. You need ${pointsCost} points to perform this action.`);
            }

            try {
                this.plugin.statCardData.points -= pointsCost;

                const theme = this.plugin.themeService.getCurrentTheme();
                const systemMessage = theme.flavor.systemMessage;

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
                                    "enum": ["answer", "code_generation", "analysis", "creative"],
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
                        "content": systemMessage
                    },
                    {
                        "role": "user",
                        "content": `I'd like you to perform this task: ${instruction}`
                    }
                ];

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 600000);
                
                const response = await fetch(`${this.plugin.settings.apiUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.plugin.settings.apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.plugin.settings.selectedLLMModel,
                        messages: messages,
                        tools: [{ "type": "function", "function": functions[0] }],
                        tool_choice: { "type": "function", "function": { "name": "perform_task" } }
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API error: ${response.status} - ${errorText}`);
                }

                const data = await response.json();
                
                let result = "";
                let title = "Untitled Task";
                
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    const message = data.choices[0].message;
                    
                    if (message.tool_calls && message.tool_calls[0]) {
                        try {
                            const toolCall = message.tool_calls[0];
                            const functionArgs = JSON.parse(toolCall.function.arguments);
                            
                            if (functionArgs.result) {
                                result = functionArgs.result;
                                title = functionArgs.title || "Untitled Task";
                            }
                        } catch (e) {
                            console.warn("Error parsing tool_calls arguments", e);
                        }
                    }

                    if (!result && message.parameters && message.parameters.result) {
                        result = message.parameters.result;
                        title = message.parameters.title || "Untitled Task";
                    }
                    
                    if (!result) {
                        const responseStr = JSON.stringify(data);
                        const resultRegex = /"result"\s*:\s*"((?:\\"|[^"])+)"/;
                        const match = responseStr.match(resultRegex);
                        if (match && match[1]) {
                            result = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
                            
                            const titleRegex = /"title"\s*:\s*"((?:\\"|[^"])+)"/;
                            const titleMatch = responseStr.match(titleRegex);
                            if (titleMatch && titleMatch[1]) {
                                title = titleMatch[1].replace(/\\"/g, '"');
                            }
                        }
                    }
                    if (!result && message.name === "perform_task" && message.parameters) {
                        if (message.parameters.result) {
                            result = message.parameters.result;
                            title = message.parameters.title || "Untitled Task";
                        }
                    }
                    
                    if (!result && message.content) {
                        result = message.content;
                    }
                }
                
                if (!result) {
                    console.error("Unexpected response format", data);
                    throw new Error("Could not extract result from LLM response");
                }
                
                this.plugin.statCardData.stats.tasksCompleted++;
                
                await this.saveResultToVault(result, title, pointsCost);
                
                return result;
            } catch (error) {
                console.error("Error executing LLM task:", error);
            
                this.plugin.statCardData.points += pointsCost;
                
                if (error.name === 'AbortError') {
                    throw new Error("The request timed out. The powers are not responding.");
                }
                
                throw error;
            }
        } finally {
            await this.plugin.saveStatCardData();            
            this.plugin.processingIndicatorService.endProcessing();
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
                    "content": "You need to assign a point cost for completing a task. Assign points based on complexity: trivial (1-5 points), simple (5-10 points), moderate (10-30 points), complex (30-50 points), extreme (50-1000 points). Be fair in your assessment."
                },
                {
                    "role": "user",
                    "content": `I request your judgement for this task: "${instruction}". What is the cost?`
                }
            ];

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000*2); // 2 minute timeout
            
            const response = await fetch(`${this.plugin.settings.apiUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.apiKey}`
                },
                body: JSON.stringify({
                    model: this.plugin.settings.selectedLLMModel,
                    messages: messages,
                    temperature: 0.5,
                    tools: [{ "type": "function", "function": functions[0] }],
                    tool_choice: { "type": "function", "function": { "name": "determine_cost" } }
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            
            if (data.choices && data.choices[0] && data.choices[0].message && 
                data.choices[0].message.tool_calls && data.choices[0].message.tool_calls[0]) {
                
                const toolCall = data.choices[0].message.tool_calls[0];
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                let cost = Math.round(functionArgs.points);
                
                if (this.plugin.statCardData.activeEffects?.storeDiscount) {
                    const discount = this.plugin.statCardData.activeEffects.storeDiscount;
                    const now = Date.now();
                    
                    if (discount.expiresAt > now) {
                        cost = Math.max(1, Math.floor(cost * (1 - discount.value)));
                    }
                }    
                return cost;                
            }
            
            throw new Error("Could not determine task cost");
        } catch (error) {
            console.error("Error determining task cost:", error);
            if (error.name === 'AbortError') {
                throw new Error("The request timed out. The dark powers are not responding.");
            }
            return 10;
        }
    }

    private async generateTheme(instruction: string): Promise<string> {
        const pointsCost = 500;
        
        if (this.plugin.statCardData.points < pointsCost) {
            throw new Error(`Not enough points. You need ${pointsCost} points to create a custom theme.`);
        }

        try {
            this.plugin.statCardData.points -= pointsCost;
            
            const themeService = new ThemeService(this.plugin);
            const newTheme = await themeService.generateCustomTheme(instruction);
            
            themeService.switchTheme('custom');
            
            if (this.plugin.statCardService) {
                this.plugin.statCardService.refreshUI();
            }
            
            return `Custom theme "${newTheme.name}" has been created and activated. The UI will now use this theme's terminology and style.`;
        } catch (error) {
            console.error("Error generating theme:", error);
            
            this.plugin.statCardData.points += pointsCost;
            
            throw new Error(`Failed to generate theme: ${error.message}`);
        }
    }

    private getEnhancedFunctionDefinitions(): any[] {
        return [
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
            },
            {
                "name": "generate_creative_content",
                "description": "Generate creative content like stories, poems, or descriptions",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "content": {
                            "type": "string",
                            "description": "The creative content generated"
                        },
                        "title": {
                            "type": "string",
                            "description": "Title for the creative work"
                        },
                        "genre": {
                            "type": "string",
                            "description": "Genre or type of creative work"
                        }
                    },
                    "required": ["content", "title"]
                }
            },
            {
                "name": "answer_question",
                "description": "Provide a direct answer to a question",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "answer": {
                            "type": "string",
                            "description": "The answer to the question"
                        },
                        "confidence": {
                            "type": "string",
                            "enum": ["high", "medium", "low"],
                            "description": "Confidence level in the answer"
                        }
                    },
                    "required": ["answer"]
                }
            },
            {
                "name": "provide_code",
                "description": "Generate code in response to a programming request",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "The generated code"
                        },
                        "language": {
                            "type": "string",
                            "description": "Programming language of the code"
                        },
                        "explanation": {
                            "type": "string",
                            "description": "Explanation of how the code works"
                        }
                    },
                    "required": ["code"]
                }
            }
        ];
    }

    private extractContentFromResponse(data: any): { content: string, title: string } {
        let content = "";
        let title = "Untitled Task";
        
        if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
            return { content, title };
        }
        
        const message = data.choices[0].message;
        
        if (message.tool_calls && message.tool_calls.length > 0) {
            try {
                const toolCall = message.tool_calls[0];
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                
                switch(functionName) {
                    case "perform_task":
                        content = args.result || "";
                        title = args.title || "Task Result";
                        break;
                    case "generate_creative_content":
                        content = args.content || "";
                        title = args.title || "Creative Content";
                        break;
                    case "answer_question":
                        content = args.answer || "";
                        title = "Question Answer";
                        break;
                    case "provide_code":
                        content = args.code || "";
                        if (args.explanation) {
                            content += "\n\n" + args.explanation;
                        }
                        title = `Code (${args.language || "unknown"})`;
                        break;
                    default:
                        for (const key in args) {
                            if (typeof args[key] === "string" && args[key].length > 0) {
                                content = args[key];
                                break;
                            }
                        }
                }
            } catch (parseError) {
                console.warn("Error parsing tool call arguments", parseError);
            }
        }
        
        if (!content && message.content) {
            content = message.content;
            title = "Direct Response";
        }
        
        return { content, title };
    }

    private async saveResultToVault(content: string, title: string, pointsCost: number): Promise<void> {
        try {
            const folderPath = 'QuestLog';
            const folder = this.plugin.app.vault.getAbstractFileByPath(folderPath);
            
            if (!folder) {
                await this.plugin.app.vault.createFolder(folderPath);
            }
            
            const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
            const randomStr = Math.random().toString(36).substring(2, 8);
            const safeTitle = title ? title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20) : 'untitled';
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
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
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
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('redeem-task-modal');
        
        const theme = this.plugin.themeService.getCurrentTheme();
        
        const header = contentEl.createDiv({ cls: 'redeem-header' });
        header.createEl('h2', { text: 'Beseech Unknown Powers' });
        
        const pointsContainer = contentEl.createDiv({ cls: 'points-display' });
        const pointsValue = pointsContainer.createSpan({ cls: 'points-value' });
        pointsValue.setText(`${this.plugin.statCardData.points}`);
        const pointsLabel = pointsContainer.createSpan({ cls: 'points-label' });
        pointsLabel.setText(` ${theme?.uiElements?.points || 'Points'} Available`);
        
        const inputSection = contentEl.createDiv({ cls: 'input-section' });
        inputSection.createEl('label', { 
            text: 'What do you wish to request?',
            cls: 'input-label'
        });
        
        const instructionInput = new TextComponent(inputSection)
            .setPlaceholder('Enter your request here...')
            .onChange((value) => {
                this.instruction = value;
            });
        
        instructionInput.inputEl.classList.add('redeem-input');
        instructionInput.inputEl.style.minHeight = '120px';
        instructionInput.inputEl.style.width = '100%';
        
        setTimeout(() => {
            instructionInput.inputEl.focus();
        }, 50);
        
        const buttonContainer = contentEl.createDiv({ cls: 'redeem-buttons' });
        
        const requestButton = new ButtonComponent(buttonContainer)
            .setButtonText('Request')
            .setCta()
            .onClick(async () => {
                if (!this.instruction) {
                    new Notice('You must specify your request.');
                    return;
                }
                
                try {
                    this.close();
                    
                    const processingNotice = new Notice('Transmitting through the ether...', 0           );
                    
                    const llmService = new LLMTaskService(this.plugin);
                    const cost = await llmService.determineTaskCost(this.instruction);
                    
                    if (this.plugin.statCardData.points < cost) {
                        processingNotice.hide();
                        new Notice(`Not enough ${theme?.uiElements?.points || 'points'}. You need ${cost} to perform this action.`);
                        new StatCardModal(this.app, this.plugin).open();
                        return;
                    }
                    
                    const result = await llmService.executeTask(this.instruction);
                    processingNotice.hide();
                    
                    if (this.plugin.statCardService) {
                        this.plugin.statCardService.refreshUI();
                    }
                    
                    const resultModal = new TaskResultModal(this.app, this.plugin, result);
                    resultModal.open();
                } catch (error) {
                    console.error('Error executing task:', error);
                    new Notice(`The request failed. ${error.message}`);
                    new StatCardModal(this.app, this.plugin).open();
                }
            });
            
        instructionInput.inputEl.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                requestButton.buttonEl.click();
            }
        });
		
		        
        const dismissButton = new ButtonComponent(buttonContainer)
            .setButtonText('Dismiss')
            .onClick(() => {
                this.close();
            });
    }
    
    onClose() {
        const { contentEl } = this;
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
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: 'Response' });

        const resultContainer = contentEl.createDiv({ cls: 'task-result-container' });

        const MarkdownIt = (window as any).markdownit;
        if (MarkdownIt) {
            const md = new MarkdownIt();
            const renderedMarkdown = md.render(this.result);

            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = renderedMarkdown;

            while (tempDiv.firstChild) {
                resultContainer.appendChild(tempDiv.firstChild);
            }
        } else {
            this.result.split("\n").forEach(line => {
                const p = resultContainer.createEl("p", { text: line });
            });
        }

        const buttonContainer = contentEl.createDiv({ cls: 'task-result-buttons' });

        new ButtonComponent(buttonContainer)
            .setButtonText('Return')
            .onClick(() => {
                this.close();
            });
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
