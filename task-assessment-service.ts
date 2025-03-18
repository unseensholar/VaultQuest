import { Notice, TFile, normalizePath } from 'obsidian';
import GamifyPlugin from './main';

interface TaskIdentifier {
    filePath: string;
    taskText: string;
    completed: boolean;
    lastUpdated: number;
    points: number;
    tags: string[];
}

interface TaskStatsStorage {
    processedTasks: TaskIdentifier[];
}

export interface RateLimitConfig {
    enabled: boolean;
    requestsPerMinute: number;
}

export class TaskAssessmentService {
    private plugin: GamifyPlugin;
    private requestQueue: Array<() => Promise<void>> = [];
    private isProcessing: boolean = false;
    private lastRequestTime: number = 0;
    private taskStoragePath: string = 'QuestLog/task_storage.json';
    
    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
    }

    async initializeTaskStorage(): Promise<void> {
        if (!await this.plugin.app.vault.adapter.exists(this.taskStoragePath)) {
            await this.plugin.app.vault.adapter.write(
                this.taskStoragePath, 
                JSON.stringify({ processedTasks: [] })
            );
        }
    }
    
    async loadTaskStorage(): Promise<TaskIdentifier[]> {
        if (await this.plugin.app.vault.adapter.exists(this.taskStoragePath)) {
            const data = await this.plugin.app.vault.adapter.read(this.taskStoragePath);
            try {
                const parsed = JSON.parse(data);
                return parsed.processedTasks || [];
            } catch (e) {
                console.error("Error parsing task storage:", e);
                return [];
            }
        }
        return [];
    }
    
    async saveTaskStorage(tasks: TaskIdentifier[]): Promise<void> {
        await this.plugin.app.vault.adapter.write(
            this.taskStoragePath,
            JSON.stringify({ processedTasks: tasks })
        );
    }

    async isTaskProcessed(filePath: string, taskText: string): Promise<boolean> {
        const tasks = await this.loadTaskStorage();
        return tasks.some(task => 
            task.filePath === filePath && 
            task.taskText === taskText && 
            task.completed === true
        );
    }
    
    async getTask(filePath: string, taskText: string): Promise<TaskIdentifier | null> {
        const tasks = await this.loadTaskStorage();
        return tasks.find(task => 
            task.filePath === filePath && 
            task.taskText === taskText
        ) || null;
    }

    async addProcessedTask(filePath: string, taskText: string, points: number, tags: string[]): Promise<void> {
        const tasks = await this.loadTaskStorage();
        
        const existingTaskIndex = tasks.findIndex(task => 
            task.filePath === filePath && task.taskText === taskText
        );
        
        if (existingTaskIndex >= 0) {
            tasks[existingTaskIndex].completed = true;
            tasks[existingTaskIndex].lastUpdated = Date.now();
            tasks[existingTaskIndex].points = points;
            tasks[existingTaskIndex].tags = tags;
        } else {
            tasks.push({
                filePath,
                taskText,
                completed: true,
                lastUpdated: Date.now(),
                points,
                tags
            });
        }
        
        await this.saveTaskStorage(tasks);
    }
    
    async markTaskUncompleted(filePath: string, taskText: string): Promise<void> {
        const tasks = await this.loadTaskStorage();
        
        const existingTaskIndex = tasks.findIndex(task => 
            task.filePath === filePath && task.taskText === taskText
        );
        
        if (existingTaskIndex >= 0 && tasks[existingTaskIndex].completed) {
            const points = tasks[existingTaskIndex].points;
            
            tasks[existingTaskIndex].completed = false;
            tasks[existingTaskIndex].lastUpdated = Date.now();
            await this.saveTaskStorage(tasks);
            
            if (this.plugin.settings.deductPointsForUnchecking) {
                this.plugin.statCardData.points -= points;
                this.plugin.statCardData.stats.tasksUnchecked++;
                this.plugin.statCardData.stats.totalPointsDeducted += points;
                
                //await this.plugin.saveStatCardData();
                this.plugin.statCardService.refreshUI();
                
                new Notice(`Task unchecked. Deducted ${points} points.`);
            }
        }
    }

    async processNoteTasks(content: string, filePath: string): Promise<void> {
        const currentTasks = this.extractTasksFromNote(content);
        
        const storedTasks = await this.loadTaskStorage();
        const fileTasks = storedTasks.filter(task => task.filePath === filePath);
        
        for (const task of currentTasks) {
            if (task.completed) {
                const isAlreadyProcessed = await this.isTaskProcessed(filePath, task.taskText);
                
                if (!isAlreadyProcessed) {
                    const tags = this.plugin.extractTags(task.taskText);
                    this.queueTaskAssessment(filePath, task.taskText, tags);
                }
            } else {
                const wasCompleted = fileTasks.some(storedTask => 
                    storedTask.taskText === task.taskText && storedTask.completed === true
                );
                
                if (wasCompleted) {
                    await this.markTaskUncompleted(filePath, task.taskText);
                }
            }
        }
    }
    
    extractTasksFromNote(content: string): Array<{taskText: string, completed: boolean}> {
        const tasks = [];
        
        const taskRegex = /- \[([ xX])\]\s+(.*?)(?:\n|$)/g;
        let match;
        
        while ((match = taskRegex.exec(content)) !== null) {
            const isCompleted = match[1].toLowerCase() === 'x';
            const taskText = match[2].trim();
            
            tasks.push({
                taskText,
                completed: isCompleted
            });
        }
        
        return tasks;
    }
 
    async assessCompletedTasks(): Promise<void> {
        if (this.plugin.settings.trackedNotes.length === 0) {
            new Notice('No notes are being tracked. Add notes using the "Track Current Note for Tasks" command.');
            return;
        }
        
        let newTasksAssessing = 0;
        
        for (const notePath of this.plugin.settings.trackedNotes) {
            const file = this.plugin.app.vault.getAbstractFileByPath(notePath);
            if (file instanceof TFile) {
                const content = await this.plugin.app.vault.read(file);
                await this.processNoteTasks(content, file.path);
                
                const tasks = this.extractTasksFromNote(content);
                const completedTasks = tasks.filter(task => task.completed);
                
                for (const task of completedTasks) {
                    const isAlreadyProcessed = await this.isTaskProcessed(file.path, task.taskText);
                    if (!isAlreadyProcessed) {
                        newTasksAssessing++;
                    }
                }
            }
        }
        
        if (newTasksAssessing > 0) {
            new Notice(`Assessment started for ${newTasksAssessing} new completed tasks.`);
			this.plugin.statCardData.stats.tasksCompleted += 1;
			this.plugin.updateStreak();
			this.plugin.checkForAchievements();
			//await this.plugin.saveStatCardData();
			this.plugin.statCardService.refreshUI();				
        } else {
            new Notice('Scan complete! No new completed tasks found.');
        }
    }

    queueTaskAssessment(filePath: string, taskText: string, tags: string[]): void {
        const task = async () => {
            try {
                const points = await this.plugin.calculatePointsForTask(taskText, tags);
                
                this.plugin.statCardData.points += points;
                this.plugin.statCardData.stats.tasksCompleted++;
                this.plugin.statCardData.stats.totalPointsEarned += points;
                this.plugin.checkForAchievements();
                await this.addProcessedTask(filePath, taskText, points, tags);
                this.plugin.statCardService.refreshUI();
                
                new Notice(`Task assessed! Earned ${points} points.`);
            } catch (error) {
                console.error("Error assessing task:", error);
                new Notice("Error assessing task. See console for details.");
            }
        };
        this.plugin.processingIndicatorService.startProcessing('assessment');
        this.requestQueue.push(task);
        try {
			if (!this.isProcessing) {
				this.processQueue();
			}
		} finally {
			this.plugin.processingIndicatorService.endProcessing();
		}	
    }
    
   
    async processQueue(): Promise<void> {
        if (this.requestQueue.length === 0) {
            this.isProcessing = false;
            return;
        }
        
        this.isProcessing = true;
        
        if (this.plugin.settings.rateLimiting && this.plugin.settings.rateLimiting.enabled) {
            const now = Date.now();
            const minTimeGap = 60000 / this.plugin.settings.rateLimiting.requestsPerMinute;
            const timeElapsed = now - this.lastRequestTime;
            
            if (timeElapsed < minTimeGap) {
                await new Promise(resolve => setTimeout(resolve, minTimeGap - timeElapsed));
            }
        }
        
        const task = this.requestQueue.shift();
        
        if (task) {
            this.lastRequestTime = Date.now();
            await task();
        }
        
        this.processQueue();
    }

    async handleFileModified(file: TFile): Promise<void> {
        if (this.plugin.settings.trackedNotes.includes(file.path)) {
            const content = await this.plugin.app.vault.read(file);
            await this.processNoteTasks(content, file.path);
        }
    }
}
export async function deleteTask(filePath: string, taskText: string): Promise<void> {
    const tasks = await this.loadTaskStorage();
	const filteredTasks = tasks.filter((task: TaskIdentifier) => 
		!(task.filePath === filePath && task.taskText === taskText)
	);

    await this.saveTaskStorage(filteredTasks);
}