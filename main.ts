import { App, MarkdownView, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, EventRef, Notice, Modal, WorkspaceLeaf } from 'obsidian';
import { StatCardService, LLMTaskService } from './services';

interface GamifyPluginSettings {
	xpPerCharacter: number;
	pointsBaseValue: number;
	tagMultipliers: Record<string, number>;
	apiUrl: string;
	apiKey: string;
	trackedNotes: string[];
    removeTagOnUncheck: boolean;
}

interface StatCardData {
	xp: number;
	level: number;
	points: number;
	nextLevelXp: number;
	skills: Skill[];
	items: Item[];
	achievements: Achievement[];
	stats: Stats;
}

interface Skill {
	id: string;
	name: string;
	level: number;
	xp: number;
}

interface Item {
	id: string;
	name: string;
	description: string;
	cost: number;
	effects: string[];
}

interface Achievement {
	id: string;
	name: string;
	description: string;
	unlockedAt: string;
}

interface Stats {
	tasksCompleted: number;
	totalPointsEarned: number;
	highestDifficulty: number;
}

interface ProcessedTask {
	filePath: string;
	taskText: string;
	completedOn: string;
}

const DEFAULT_SETTINGS: GamifyPluginSettings = {
	xpPerCharacter: 0.1,
	pointsBaseValue: 10,
	tagMultipliers: {
		'#easy': 0.5,
		'#medium': 1.0,
		'#hard': 2.0,
		'#veryhard': 5.0
	},
	apiUrl: 'http://196.168.10.1:1234',
	apiKey: 'your-api-key',
	trackedNotes: [],
    removeTagOnUncheck: true,
}

export default class GamifyPlugin extends Plugin {
	settings: GamifyPluginSettings;
	statCardData: StatCardData;
    statCardService: StatCardService;
    llmTaskService: LLMTaskService;
	fileChangedEventRef: EventRef;
	processedTasks: ProcessedTask[] = [];
	typing: {
		characterCount: number;
		timeout: NodeJS.Timeout | null;
	};



	
	private loadStyles() {

		const styleEl = document.createElement('style');
		styleEl.id = 'gamify-styles';
		styleEl.textContent = this.getStyles();
		document.head.appendChild(styleEl);
	}


	private getStyles(): string {
		return `
		/* Base styles for the modal */
		.gamify-stat-card-modal {
			background-color: var(--background-primary);
			color: var(--text-normal);
			padding: 1rem;
		}

		/* Title styling */
		.gamify-modal-title {
			color: var(--text-accent);
			margin-bottom: 1rem;
			text-align: center;
			font-size: 1.8rem;
		}

		/* Section headings */
		.gamify-section-heading {
			color: var(--text-accent);
			margin: 1rem 0 0.5rem;
			font-size: 1.4rem;
		}

		/* Stats containers */
		.gamify-stats-container,
		.gamify-stats-details,
		.gamify-skills-section,
		.gamify-redeem-section {
			margin-bottom: 1.5rem;
			padding: 0.75rem;
			border-radius: 4px;
			background-color: var(--background-secondary);
		}

		/* XP Bar styling */
		.gamify-xp-bar {
			height: 10px;
			background-color: var(--background-modifier-border);
			border-radius: 5px;
			margin: 0.5rem 0;
			overflow: hidden;
		}

		.gamify-xp-bar-fill {
			height: 100%;
			background-color: var(--text-accent);
			border-radius: 5px;
			transition: width 0.3s ease-in-out;
		}

		/* Stat items */
		.gamify-stat-item {
			margin: 0.25rem 0;
			font-size: 0.9rem;
		}

		/* Skills list */
		.gamify-skills-list {
			margin: 0.5rem 0;
			padding-left: 1.5rem;
		}

		.gamify-skill-item {
			margin: 0.25rem 0;
		}

		/* Button styling */
		.gamify-summon-button {
			background-color: var(--interactive-accent);
			color: var(--text-on-accent);
			border: 1px solid var(--interactive-accent-hover);
		}

		.gamify-summon-button:hover {
			background-color: var(--interactive-accent-hover);
		}

		/* Task result container */
		.task-result-container {
			max-height: 400px;
			overflow: auto;
			padding: 10px;
			border: 1px solid var(--background-modifier-border);
			margin: 10px 0;
			background-color: var(--background-secondary);
		}
		`;
	}

	async onload() {
		this.app.workspace.onLayoutReady(async () => { //Hopefully this solves the data loading issues

		await this.loadSettings();
		await this.loadStatCardData();
		await this.loadProcessedTasks();

		// Initialize services
        this.statCardService = new StatCardService(this);
        this.llmTaskService = new LLMTaskService(this);
        this.statCardService.initializeUI();
		this.statCardService.refreshUI(); // Force an update to load data from the file
		this.loadStyles();
		
		// Initialize typing tracker
		this.typing = {
			characterCount: 0,
			timeout: null
		};

		// Register event for typing XP
		this.registerDomEvent(document, 'keydown', (evt: KeyboardEvent) => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view && this.isContentKey(evt)) {
				this.handleTyping();
			}
		});

		// Monitor file changes only for tracked notes
		this.fileChangedEventRef = this.app.vault.on('modify', this.handleFileChanged.bind(this));
		

		this.addCommand({
			id: 'track-current-note',
			name: 'Track Current Note for Tasks',
			callback: () => this.trackCurrentNote()
		});
		
		this.addCommand({
			id: 'untrack-note',
			name: 'Remove Note from Task Tracking',
			callback: () => this.showUntrackNoteModal()
		});
		
		this.addCommand({
			id: 'scan-tasks',
			name: 'Scan for Completed Tasks',
			callback: () => this.scanAllTrackedNotes()
		});
		

		this.addSettingTab(new GamifySettingTab(this.app, this));
		});		
	}

	onunload() {

		if (this.typing.timeout) {
			clearTimeout(this.typing.timeout);
			this.processTypingXp();
		}


		const styleEl = document.getElementById('gamify-styles');
		if (styleEl) styleEl.remove();
		

		this.app.vault.offref(this.fileChangedEventRef);

	}

	isContentKey(evt: KeyboardEvent): boolean {

		return !evt.ctrlKey && !evt.altKey && !evt.metaKey && 
			evt.key.length === 1 && !evt.repeat;
	}

	handleTyping() {
		this.typing.characterCount++;
		

		if (this.typing.timeout) {
			clearTimeout(this.typing.timeout);
		}
		
		this.typing.timeout = setTimeout(() => {
			this.processTypingXp();
		}, 2000); // Should probably change the inactivity time
	}

	processTypingXp() {
		const xpGained = this.typing.characterCount * this.settings.xpPerCharacter;
		this.statCardData.xp += xpGained;
		this.typing.characterCount = 0;
		this.typing.timeout = null;
		
		// Potential performance issue - revisit
		this.checkForLevelUp();
		

		this.saveStatCardData();
        

        this.statCardService.refreshUI();
		
	}

	async trackCurrentNote() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file to track.');
			return;
		}
		
		const filePath = activeFile.path;
		if (!this.settings.trackedNotes.includes(filePath)) {
			this.settings.trackedNotes.push(filePath);
			await this.saveSettings();
			new Notice(`Now tracking "${activeFile.basename}" for tasks.`);
		} else {
			new Notice(`Already tracking "${activeFile.basename}".`);
		}
	}

	async showUntrackNoteModal() {
		if (this.settings.trackedNotes.length === 0) {
			new Notice('No notes are currently being tracked.');
			return;
		}
		
		const modal = new SelectNoteModal(
			this.app, 
			this.settings.trackedNotes,
			async (selectedPath) => {
				this.settings.trackedNotes = this.settings.trackedNotes.filter(path => path !== selectedPath);
				await this.saveSettings();
				new Notice(`Stopped tracking "${selectedPath.split('/').pop()}".`);
			}
		);
		
		modal.open();
	}

	async scanAllTrackedNotes() {
		if (this.settings.trackedNotes.length === 0) {
			new Notice('No notes are being tracked. Add notes using the "Track Current Note for Tasks" command.');
			return;
		}
		
		let tasksFound = 0;
		let newTasksCompleted = 0;
		
		for (const notePath of this.settings.trackedNotes) {
			const file = this.app.vault.getAbstractFileByPath(notePath);
			if (file instanceof TFile) {
				const content = await this.app.vault.read(file);
				const newTasks = await this.processCompletedTasksInNote(content, file.path);
				tasksFound += newTasks.tasksFound;
				newTasksCompleted += newTasks.newTasksCompleted;
			}
		}
		
		if (newTasksCompleted > 0) {
			new Notice(`Scan complete! Found ${tasksFound} completed tasks, ${newTasksCompleted} new.`);
		} else {
			new Notice(`Scan complete! Found ${tasksFound} completed tasks, all already processed.`);
		}
	}

	async handleFileChanged(file: TAbstractFile) {
		if (!(file instanceof TFile) || file.extension !== 'md') {
			return;
		}
		

		if (this.settings.trackedNotes.includes(file.path)) {
			const content = await this.app.vault.read(file);
			

			await this.handleUncheckedTasks(content, file.path);
			
			// process completed tasks, re-read the file in case it was modified, potential issue with resetting pending changes - revisit
			const updatedContent = await this.app.vault.read(file);
			await this.processCompletedTasksInNote(updatedContent, file.path);
		}
	}
	async handleUncheckedTasks(content: string, filePath: string): Promise<boolean> {
		if (!this.settings.removeTagOnUncheck) return false;
		
		// Regex to find task content needs some work - revisit
		const uncheckedTaskRegex = /- \[\s*\]\s+(.*?)(#VQdone)(\s|$)/g;
		let hasChanges = false;
		let updatedContent = content;
		
		// Replace all instances probably not the best approach - revisit
		updatedContent = updatedContent.replace(uncheckedTaskRegex, (match, taskText, doneTag, ending) => {
			hasChanges = true;
			return `- [ ] ${taskText}${ending}`;
		});
		
		if (hasChanges) {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile) {
				await this.app.vault.modify(file, updatedContent);
			}
		}
		
		return hasChanges;
	}
	
	async processCompletedTasksInNote(content: string, filePath: string): Promise<{tasksFound: number, newTasksCompleted: number}> {
		// Regular expression to find completed tasks without the #VQdone tag - needs work - revisit
		const completedTaskRegex = /- \[x\]\s+((?:(?!#VQdone).)*?)(?:\n|$)/g;		
		let match;
		let tasksFound = 0;
		let newTasksCompleted = 0;
		let updatedContent = content;
		
		while ((match = completedTaskRegex.exec(content)) !== null) {
			const taskText = match[1].trim();
			
			if (taskText.includes('#VQdone')) {
				continue;
			}
			
			tasksFound++;
			
			// Need to check the logic to find alternatives - revisit
			if (!this.isTaskProcessed(filePath, taskText)) {

				const tags = this.extractTags(taskText);
				const points = await this.calculatePointsForTask(taskText, tags);
				

				this.statCardData.points += points;
				this.statCardData.stats.tasksCompleted++;
				this.statCardData.stats.totalPointsEarned += points;
				

				this.addProcessedTask(filePath, taskText);
				newTasksCompleted++;
				
				// Add #VQdone tag to the task in the file - possible issues but none so far - revisit
				const originalTask = `- [x] ${taskText}`;
				const taggedTask = `- [x] ${taskText} #VQdone`;
				updatedContent = updatedContent.replace(originalTask, taggedTask);
				
				// Save data after each processed task - needed? - revisit
				await this.saveStatCardData();
				await this.saveProcessedTasks();
						
				// Update UI could probably be unified somewhere - revisit
				this.statCardService.refreshUI();              
				
				// Notify the user only once per scan - issues - may remove later - revisit
				if (newTasksCompleted === 1) {
					new Notice(`Task completed! You earned ${points} points.`);
				}
			}
		}
		
		// Update the file with the #VQdone tags - alternatives? - revisit
		if (newTasksCompleted > 0) {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile) {
				await this.app.vault.modify(file, updatedContent);
			}
		}
		
		return { tasksFound, newTasksCompleted };
	}
	isTaskProcessed(filePath: string, taskText: string): boolean {
		return this.processedTasks.some(task => 
			task.filePath === filePath && task.taskText === taskText);
	}

	addProcessedTask(filePath: string, taskText: string) {
		this.processedTasks.push({
			filePath,
			taskText,
			completedOn: new Date().toISOString()
		});
	}

	extractTags(text: string): string[] {
		const tagRegex = /#[\w-]+/g;
		return (text.match(tagRegex) || []);
	}

	async calculatePointsForTask(taskText: string, tags: string[]): Promise<number> {
		// Use LLM first, fallback to basic calculation - should include some indicator in status bar - revisit
		try {
			return await this.calculatePointsWithLLM(taskText, tags);
		} catch (error) {
			console.error("Error calculating points with LLM:", error);
			return this.calculateBasicPoints(tags);
		}
	}

	calculateBasicPoints(tags: string[]): number {
		let multiplier = 1.0;
		

		for (const tag of tags) {
			if (this.settings.tagMultipliers[tag]) {
				multiplier = Math.max(multiplier, this.settings.tagMultipliers[tag]);
			}
		}
		
		return Math.round(this.settings.pointsBaseValue * multiplier);
	}

	async calculatePointsWithLLM(taskText: string, tags: string[]): Promise<number> {
		// Prepare the query for the LLM - work fine - use file templates? - revisit
		const functions = [
			{
				"name": "assign_points",
				"description": "Assign points to a completed task based on its difficulty",
				"parameters": {
					"type": "object",
					"properties": {
						"points": {
							"type": "number",
							"description": "The number of points to award for the task"
						},
						"reasoning": {
							"type": "string",
							"description": "Explanation of how points were calculated"
						},
						"difficulty_assessment": {
							"type": "string",
							"enum": ["easy", "medium", "hard", "very_hard"],
							"description": "Assessment of the task's difficulty"
						}
					},
					"required": ["points", "reasoning", "difficulty_assessment"]
				}
			}
		];

		const messages = [
			{
				"role": "system",
				"content": "You are a task assessment system that assigns points to completed tasks based on their difficulty. For difficulty, consider the complexity of the task and any tags."
			},
			{
				"role": "user",
				"content": `I just completed this task: "${taskText}". Tags: ${tags.join(', ') || 'None'}. Please assign appropriate points.`
			}
		];

		try {
			const response = await fetch(`${this.settings.apiUrl}/v1/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.settings.apiKey}`
				},
				body: JSON.stringify({
					model: "local-model",
					messages: messages,
					tools: [{ "type": "function", "function": functions[0] }],
					tool_choice: { "type": "function", "function": { "name": "assign_points" } }
				})
			});

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`);
			}

			const data = await response.json();
			
			// Extract the points from the response
			if (data.choices && data.choices[0] && data.choices[0].message && 
				data.choices[0].message.tool_calls && data.choices[0].message.tool_calls[0]) {
				
				const toolCall = data.choices[0].message.tool_calls[0];
				const functionArgs = JSON.parse(toolCall.function.arguments);
				
				// Update stats logic needs work - revisit
				if (functionArgs.difficulty_assessment === "very_hard" && 
					this.statCardData.stats.highestDifficulty < 4) {
					this.statCardData.stats.highestDifficulty = 4;
				} else if (functionArgs.difficulty_assessment === "hard" && 
					this.statCardData.stats.highestDifficulty < 3) {
					this.statCardData.stats.highestDifficulty = 3;
				} else if (functionArgs.difficulty_assessment === "medium" && 
					this.statCardData.stats.highestDifficulty < 2) {
					this.statCardData.stats.highestDifficulty = 2;
				} else if (functionArgs.difficulty_assessment === "easy" && 
					this.statCardData.stats.highestDifficulty < 1) {
					this.statCardData.stats.highestDifficulty = 1;
				}
				
				return Math.round(functionArgs.points);
			}
			
			throw new Error("Could not extract points from LLM response");
		} catch (error) {
			console.error("Error calling LLM:", error);
			throw error;
		}
	}

	checkForLevelUp() {
		while (this.statCardData.xp >= this.statCardData.nextLevelXp) {

			this.statCardData.xp -= this.statCardData.nextLevelXp;
			this.statCardData.level++;
			
			// Increase required XP for next level - find better eqn
			this.statCardData.nextLevelXp = Math.round(this.statCardData.nextLevelXp * 1.5);
			
			new Notice(`Congratulations! You reached level ${this.statCardData.level}!`);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async loadStatCardData(): Promise<void> {
		try {
			const dataFile = this.app.vault.getAbstractFileByPath('VQ/data.json');
			
			if (dataFile instanceof TFile) {

				const content = await this.app.vault.read(dataFile);
				const parsedData = JSON.parse(content);
				

				this.statCardData = parsedData.statCardData || parsedData;
			} else {

				this.initializeDefaultStatCardData();
				

				await this.saveStatCardData();
			}
		} catch (error) {
			console.error("Error loading user data:", error);
			// Initialize with default data - revisit
			this.initializeDefaultStatCardData();
		}
	}

	initializeDefaultStatCardData() {
		this.statCardData = {
			xp: 0,
			level: 1,
			points: 0,
			nextLevelXp: 100,
			skills: [
				{
					id: "writing",
					name: "Writing",
					level: 1,
					xp: 0
				},
				{
					id: "research",
					name: "Research",
					level: 1,
					xp: 0
				},
				{
					id: "organization",
					name: "Organization",
					level: 1,
					xp: 0
				}
			],
			items: [],
			achievements: [],
			stats: {
				tasksCompleted: 0,
				totalPointsEarned: 0,
				highestDifficulty: 0
			}
		};
	}

	async saveStatCardData(): Promise<void> {
		try {
			const data = JSON.stringify({ 
				statCardData: this.statCardData,
			}, null, 2);
			

			const dataFile = this.app.vault.getAbstractFileByPath('VQ/data.json');
			
			if (dataFile instanceof TFile) {

				await this.app.vault.modify(dataFile, data);
			} else {

				await this.app.vault.create('VQ/data.json', data);
			}
		} catch (error) {
			console.error("Error saving user data:", error);
			new Notice("Error saving progress data.");
		}
	}

	async loadProcessedTasks(): Promise<void> {
		try {

			const folderPath = 'VQ';
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			
			if (!folder) {
				await this.app.vault.createFolder(folderPath);
			}
			
			// Tasks.json is probably unnecessary - disabled for now - revisit
			const tasksFile = this.app.vault.getAbstractFileByPath(`${folderPath}/tasks.json`);
			
			if (tasksFile instanceof TFile) {

				const content = await this.app.vault.read(tasksFile);
				this.processedTasks = JSON.parse(content);
			} else {

				this.processedTasks = [];
				await this.saveProcessedTasks();
			}
		} catch (error) {
			console.error("Error loading processed tasks:", error);
			this.processedTasks = [];
		}
	}

	async saveProcessedTasks(): Promise<void> {
		try {
			const folderPath = 'VQ';
			//const data = JSON.stringify(this.processedTasks, null, 2); //waste of resource - revisit
			const data = "Disabled";

			const tasksFile = this.app.vault.getAbstractFileByPath(`${folderPath}/tasks.json`);
			
			if (tasksFile instanceof TFile) {

				await this.app.vault.modify(tasksFile, data);
			} else {

				const folder = this.app.vault.getAbstractFileByPath(folderPath);
				if (!folder) {
					await this.app.vault.createFolder(folderPath);
				}
				

				await this.app.vault.create(`${folderPath}/tasks.json`, data);
			}
		} catch (error) {
			console.error("Error saving processed tasks:", error);
		}
	}
}

class GamifySettingTab extends PluginSettingTab {
	plugin: GamifyPlugin;

	constructor(app: App, plugin: GamifyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		

		containerEl.createEl('h2', {text: 'XP/Point Modifier'});
		
		new Setting(containerEl)
			.setName('XP per character')
			.setDesc('How much XP is earned for each character typed.')
			.addText(text => text
				.setValue(this.plugin.settings.xpPerCharacter.toString())
				.onChange(async (value) => {
					this.plugin.settings.xpPerCharacter = parseFloat(value) || 0.1;
					await this.plugin.saveSettings();
				}));
		

		new Setting(containerEl)
			.setName('Base points value')
			.setDesc('Base points awarded for completing a task.')
			.addText(text => text
				.setValue(this.plugin.settings.pointsBaseValue.toString())
				.onChange(async (value) => {
					this.plugin.settings.pointsBaseValue = parseInt(value) || 10;
					await this.plugin.saveSettings();
				}));
		

		containerEl.createEl('h2', {text: 'Tracked Notes'});
		
		const trackedNotesContainer = containerEl.createDiv();
		
		if (this.plugin.settings.trackedNotes.length === 0) {
			trackedNotesContainer.createEl('p', {
				text: 'No notes are currently being tracked. Use the "Track Current Note for Tasks" command to start tracking notes.'
			});
		} else {
			const ul = trackedNotesContainer.createEl('ul');
			this.plugin.settings.trackedNotes.forEach(path => {
				const li = ul.createEl('li');
				li.createEl('span', {text: path});
				
				const removeButton = li.createEl('button', {
					text: 'Remove',
					cls: 'gamify-remove-btn'
				});
				
				removeButton.addEventListener('click', async () => {
					this.plugin.settings.trackedNotes = this.plugin.settings.trackedNotes.filter(p => p !== path);
					await this.plugin.saveSettings();
					this.display();
				});
			});
		}
		

		containerEl.createEl('h2', {text: 'Tag Multipliers'});
		

		Object.entries(this.plugin.settings.tagMultipliers).forEach(([tag, multiplier]) => {
			new Setting(containerEl)
				.setName(`Multiplier for ${tag}`)
				.setDesc(`Multiplier for tasks with the ${tag} tag.`)
				.addText(text => text
					.setValue(multiplier.toString())
					.onChange(async (value) => {
						this.plugin.settings.tagMultipliers[tag] = parseFloat(value) || 1.0;
						await this.plugin.saveSettings();
					}))
				.addButton(button => button
					.setButtonText('Remove')
					.onClick(async () => {
						delete this.plugin.settings.tagMultipliers[tag];
						await this.plugin.saveSettings();
						this.display(); // Reload the settings panel
					}));
		});
		

		new Setting(containerEl)
			.setName('Add new tag multiplier')
			.setDesc('Add a new tag and its point multiplier.')
			.addText(text => text
				.setPlaceholder('#tag')
				.setValue(''))
			.addText(text => text
				.setPlaceholder('multiplier')
				.setValue('1.0'))
			.addButton(button => button
				.setButtonText('Add')
				.onClick(async (evt) => {
					const settingItem = evt.target as HTMLElement;
					const inputs = settingItem.parentElement?.parentElement?.querySelectorAll('input');
					if (inputs && inputs.length >= 2) {
						const tag = inputs[0].value;
						const multiplier = parseFloat(inputs[1].value) || 1.0;
						
						if (tag && tag.startsWith('#')) {
							this.plugin.settings.tagMultipliers[tag] = multiplier;
							await this.plugin.saveSettings();
							this.display(); // Reload the settings panel
						}
					}
				}));

		new Setting(containerEl)
			.setName('Remove #VQdone tag on uncheck')
			.setDesc('Automatically remove the #VQdone tag when a task is unchecked')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.removeTagOnUncheck)
				.onChange(async (value) => {
					this.plugin.settings.removeTagOnUncheck = value;
					await this.plugin.saveSettings();
				}));
				

		containerEl.createEl('h2', {text: 'LLM API'});
		
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
		

		containerEl.createEl('h2', {text: 'Progress'});
		
		const progressDiv = containerEl.createDiv();
		progressDiv.innerHTML = `
			<div style="padding: 10px; border: 1px solid var(--background-modifier-border); border-radius: 5px; margin-bottom: 20px;">
				<p><strong>Level:</strong> ${this.plugin.statCardData.level}</p>
				<p><strong>XP:</strong> ${Math.floor(this.plugin.statCardData.xp)} / ${this.plugin.statCardData.nextLevelXp}</p>
				<p><strong>Points:</strong> ${this.plugin.statCardData.points}</p>
				<p><strong>Tasks Completed:</strong> ${this.plugin.statCardData.stats.tasksCompleted}</p>
				<p><strong>Processed Tasks:</strong> ${this.plugin.processedTasks.length}</p>
			</div>
		`;
		

		new Setting(containerEl)
			.setName('Reset Processed Tasks')
			.setDesc('Clear the list of processed tasks (will allow re-earning points for completed tasks).')
			.addButton(button => button
				.setButtonText('Reset Task History')
				.setWarning()
				.onClick(async () => {
					this.plugin.processedTasks = [];
					await this.plugin.saveProcessedTasks();
					this.display();
					new Notice('Task history has been reset.');
				}));
		
		new Setting(containerEl)
			.setName('Reset Progress') //Individual resets? - revisit
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
						this.plugin.processedTasks = [];
						await this.plugin.saveStatCardData();
						await this.plugin.saveProcessedTasks();
						
						this.display();
						new Notice('All progress has been reset.');
					}
				}));
	}
}

class SelectNoteModal extends Modal {
	options: string[];
	onSelect: (selected: string) => void;
	
	constructor(app: App, options: string[], onSelect: (selected: string) => void) {
		super(app);
		this.options = options;
		this.onSelect = onSelect;
	}
	
	onOpen() {
		const {contentEl} = this;
		
		contentEl.createEl("h2", {text: "Select Note to Untrack"});
		
		const ul = contentEl.createEl("ul", {cls: "gamify-modal-list"});
		
		this.options.forEach(option => {
			const li = ul.createEl("li");
			li.textContent = option;
			li.addEventListener("click", () => {
				this.onSelect(option);
				this.close();
			});
		});
	}
	
	onClose() {
		const {contentEl} = this;
		contentEl.empty();
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