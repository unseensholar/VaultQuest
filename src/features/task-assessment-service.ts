import { Notice, TFile } from 'obsidian';
import GamifyPlugin from '../main';
import { AchievementsService } from '../features/achievements';


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

export interface TaskStateChange {
    taskText: string;
    filePath: string;
    newState: 'completed' | 'uncompleted';
    timestamp: number;
    points: number;
}

export interface RateLimitConfig {
    enabled: boolean;
    requestsPerMinute: number;
}

export class TaskAssessmentService {
    private plugin: GamifyPlugin;
	private achievementsService: AchievementsService;	
    private requestQueue: Array<() => Promise<void>> = [];
    private isProcessing: boolean = false;
    private lastRequestTime: number = 0;
    private readonly taskStoragePath: string = 'QuestLog/task_storage.json';
    private readonly taskLogPath: string = 'QuestLog/task_activity_log.json';
    private taskStateListeners: Array<(change: TaskStateChange) => void> = [];
    
    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
    }

    async initializeStorage(): Promise<void> {
        const { adapter } = this.plugin.app.vault;
        if (!await adapter.exists(this.taskStoragePath)) {
            await adapter.write(
                this.taskStoragePath, 
                JSON.stringify({ processedTasks: [] })
            );
        }
        
        if (!await adapter.exists(this.taskLogPath)) {
            await adapter.write(
                this.taskLogPath,
                JSON.stringify({ taskChanges: [] })
            );
        }
    }
    
    registerTaskStateListener(callback: (change: TaskStateChange) => void): void {
        this.taskStateListeners.push(callback);
    }
    
    private notifyStateChange(change: TaskStateChange): void {
        this.taskStateListeners.forEach(listener => listener(change));
    }
    
    async logTaskStateChange(change: TaskStateChange): Promise<void> {
        const { adapter } = this.plugin.app.vault;
        let log = { taskChanges: [] as TaskStateChange[] };
        
        if (await adapter.exists(this.taskLogPath)) {
            try {
                const data = await adapter.read(this.taskLogPath);
                log = JSON.parse(data);
            } catch (e) {
                console.error("Error parsing task log:", e);
            }
        }
        
        log.taskChanges.push(change);
        await adapter.write(this.taskLogPath, JSON.stringify(log));
        
        // Notify listeners about the state change
        this.notifyStateChange(change);
    }
    
    async loadTaskStorage(): Promise<TaskIdentifier[]> {
        const { adapter } = this.plugin.app.vault;
        if (await adapter.exists(this.taskStoragePath)) {
            try {
                const data = await adapter.read(this.taskStoragePath);
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
        
        const now = Date.now();
        if (existingTaskIndex >= 0) {
            tasks[existingTaskIndex] = {
                ...tasks[existingTaskIndex],
                completed: true,
                lastUpdated: now,
                points,
                tags
            };
        } else {
            tasks.push({
                filePath,
                taskText,
                completed: true,
                lastUpdated: now,
                points,
                tags
            });
        }
        
        await this.saveTaskStorage(tasks);
        
        // Log the task completion
        await this.logTaskStateChange({
            taskText,
            filePath,
            newState: 'completed',
            timestamp: now,
            points
        });
    }
    
    async markTaskUncompleted(filePath: string, taskText: string): Promise<void> {
        const tasks = await this.loadTaskStorage();
        const existingTaskIndex = tasks.findIndex(task => 
            task.filePath === filePath && task.taskText === taskText
        );
        
        if (existingTaskIndex >= 0 && tasks[existingTaskIndex].completed) {
            const points = tasks[existingTaskIndex].points;
            const now = Date.now();
            
            tasks[existingTaskIndex].completed = false;
            tasks[existingTaskIndex].lastUpdated = now;
            await this.saveTaskStorage(tasks);
            
            // Log the task uncompleting
            await this.logTaskStateChange({
                taskText,
                filePath,
                newState: 'uncompleted',
                timestamp: now,
                points
            });
            
            if (this.plugin.settings.deductPointsForUnchecking) {
                this.plugin.statCardData.points -= points;
                this.plugin.statCardData.stats.tasksUnchecked++;
                this.plugin.statCardData.stats.totalPointsDeducted += points;
                
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
        const taskRegex = /- \[([ xX])\]\s+(.*?)(?:\n|$)/g;
        const tasks = [];
        let match;
        
        while ((match = taskRegex.exec(content)) !== null) {
            tasks.push({
                taskText: match[2].trim(),
                completed: match[1].toLowerCase() === 'x'
            });
        }
        
        return tasks;
    }
 
    async assessCompletedTasks(): Promise<void> {
        const { settings, app, statCardData, statCardService } = this.plugin;
        
        if (settings.trackedNotes.length === 0) {
            new Notice('No notes are being tracked. Add notes using the "Track Current Note for Tasks" command.');
            return;
        }
        
        let newTasksAssessing = 0;
        
        for (const notePath of settings.trackedNotes) {
            const file = app.vault.getAbstractFileByPath(notePath);
            if (file instanceof TFile) {
                const content = await app.vault.read(file);
                await this.processNoteTasks(content, file.path);
                
                const tasks = this.extractTasksFromNote(content);
                const completedTasks = tasks.filter(task => task.completed);
                
                for (const task of completedTasks) {
                    if (!await this.isTaskProcessed(file.path, task.taskText)) {
                        newTasksAssessing++;
                    }
                }
            }
        }
        
        if (newTasksAssessing > 0) {
            new Notice(`Assessment started for ${newTasksAssessing} new completed tasks.`);
            statCardData.stats.tasksCompleted += 1;
            this.plugin.updateStreak();
			this.plugin.achievementsService.checkForAchievements();
            statCardService.refreshUI();                
        } 
    }

    queueTaskAssessment(filePath: string, taskText: string, tags: string[]): void {
        const { processingIndicatorService, statCardData, statCardService } = this.plugin;
        
        const task = async () => {
            try {
                const points = await this.plugin.calculatePointsForTask(taskText, tags);
                
                statCardData.points += points;
                statCardData.stats.tasksCompleted++;
                statCardData.stats.totalPointsEarned += points;
                
				this.plugin.achievementsService.checkForAchievements();
                await this.addProcessedTask(filePath, taskText, points, tags);
                statCardService.refreshUI();
                
                new Notice(`Task assessed! Earned ${points} points.`);
            } catch (error) {
                console.error("Error assessing task:", error);
                new Notice("Error assessing task. See console for details.");
            }
        };
        
        processingIndicatorService.startProcessing('assessment');
        this.requestQueue.push(task);
        
        try {
            if (!this.isProcessing) {
                this.processQueue();
            }
        } finally {
            processingIndicatorService.endProcessing();
        }    
    }
    
    async processQueue(): Promise<void> {
        if (this.requestQueue.length === 0) {
            this.isProcessing = false;
            return;
        }
        
        this.isProcessing = true;
        
        const { settings } = this.plugin;
        if (settings.rateLimiting?.enabled) {
            const now = Date.now();
            const minTimeGap = 60000 / settings.rateLimiting.requestsPerMinute;
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
    
    async deleteTask(filePath: string, taskText: string): Promise<void> {
        const tasks = await this.loadTaskStorage();
        const filteredTasks = tasks.filter((task: TaskIdentifier) => 
            !(task.filePath === filePath && task.taskText === taskText)
        );

        await this.saveTaskStorage(filteredTasks);
    }
    
    async getRecentTaskActivity(limit = 10): Promise<TaskStateChange[]> {
        const { adapter } = this.plugin.app.vault;
        if (await adapter.exists(this.taskLogPath)) {
            try {
                const data = await adapter.read(this.taskLogPath);
                const log = JSON.parse(data);
                return (log.taskChanges || [])
                    .sort((a: TaskStateChange, b: TaskStateChange) => b.timestamp - a.timestamp)
                    .slice(0, limit);
            } catch (e) {
                console.error("Error parsing task log:", e);
                return [];
            }
        }
        return [];
    }
}
