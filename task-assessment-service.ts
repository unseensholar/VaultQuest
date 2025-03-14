import { Notice, TFile, normalizePath } from 'obsidian';
import GamifyPlugin from './main';

// Interface for a task identifier with points tracking
interface TaskIdentifier {
    filePath: string;
    taskText: string;
    completed: boolean;
    lastUpdated: number;
    points: number;
    tags: string[];
}

// Interface for task stats storage
interface TaskStatsStorage {
    processedTasks: TaskIdentifier[];
}

// Rate limiting configuration interface
export interface RateLimitConfig {
    enabled: boolean;
    requestsPerMinute: number;
}

export class TaskAssessmentService {
    private plugin: GamifyPlugin;
    private requestQueue: Array<() => Promise<void>> = [];
    private isProcessing: boolean = false;
    private lastRequestTime: number = 0;
    private taskStoragePath: string = 'VQ/task_storage.json';
    
    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
    }
    
    /**
     * Initialize the task storage file if it doesn't exist
     */
    async initializeTaskStorage(): Promise<void> {
        if (!await this.plugin.app.vault.adapter.exists(this.taskStoragePath)) {
            await this.plugin.app.vault.adapter.write(
                this.taskStoragePath, 
                JSON.stringify({ processedTasks: [] })
            );
        }
    }
    
    /**
     * Load task identifiers from storage
     */
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
    
    /**
     * Save task identifiers to storage
     */
    async saveTaskStorage(tasks: TaskIdentifier[]): Promise<void> {
        await this.plugin.app.vault.adapter.write(
            this.taskStoragePath,
            JSON.stringify({ processedTasks: tasks })
        );
    }
    
    /**
     * Check if a task has been processed
     */
    async isTaskProcessed(filePath: string, taskText: string): Promise<boolean> {
        const tasks = await this.loadTaskStorage();
        return tasks.some(task => 
            task.filePath === filePath && 
            task.taskText === taskText && 
            task.completed === true
        );
    }
    
    /**
     * Get a task from storage
     */
    async getTask(filePath: string, taskText: string): Promise<TaskIdentifier | null> {
        const tasks = await this.loadTaskStorage();
        return tasks.find(task => 
            task.filePath === filePath && 
            task.taskText === taskText
        ) || null;
    }
    
    /**
     * Add a task to the processed list
     */
    async addProcessedTask(filePath: string, taskText: string, points: number, tags: string[]): Promise<void> {
        const tasks = await this.loadTaskStorage();
        
        // Check if task already exists
        const existingTaskIndex = tasks.findIndex(task => 
            task.filePath === filePath && task.taskText === taskText
        );
        
        if (existingTaskIndex >= 0) {
            // Update existing task
            tasks[existingTaskIndex].completed = true;
            tasks[existingTaskIndex].lastUpdated = Date.now();
            tasks[existingTaskIndex].points = points;
            tasks[existingTaskIndex].tags = tags;
        } else {
            // Add new task
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
    
    /**
     * Mark a task as uncompleted
     */
    async markTaskUncompleted(filePath: string, taskText: string): Promise<void> {
        const tasks = await this.loadTaskStorage();
        
        // Find the task
        const existingTaskIndex = tasks.findIndex(task => 
            task.filePath === filePath && task.taskText === taskText
        );
        
        if (existingTaskIndex >= 0 && tasks[existingTaskIndex].completed) {
            // Get the points to deduct
            const points = tasks[existingTaskIndex].points;
            
            // Update the completion status
            tasks[existingTaskIndex].completed = false;
            tasks[existingTaskIndex].lastUpdated = Date.now();
            await this.saveTaskStorage(tasks);
            
            // Deduct points if necessary
            if (this.plugin.settings.deductPointsForUnchecking) {
                // Update stats
                this.plugin.statCardData.points -= points;
                this.plugin.statCardData.stats.tasksUnchecked++;
                this.plugin.statCardData.stats.totalPointsDeducted += points;
                
                await this.plugin.saveStatCardData();
                this.plugin.statCardService.refreshUI();
                
                new Notice(`Task unchecked. Deducted ${points} points.`);
            }
        }
    }
    
    /**
     * Process a note to find completed and uncompleted tasks
     */
    async processNoteTasks(content: string, filePath: string): Promise<void> {
        // Get current state of tasks in the note
        const currentTasks = this.extractTasksFromNote(content);
        
        // Load previously processed tasks for this file
        const storedTasks = await this.loadTaskStorage();
        const fileTasks = storedTasks.filter(task => task.filePath === filePath);
        
        // Check for newly completed tasks
        for (const task of currentTasks) {
            if (task.completed) {
                const isAlreadyProcessed = await this.isTaskProcessed(filePath, task.taskText);
                
                if (!isAlreadyProcessed) {
                    // This is a newly completed task
                    const tags = this.plugin.extractTags(task.taskText);
                    this.queueTaskAssessment(filePath, task.taskText, tags);
                }
            } else {
                // Check if this task was previously completed but now unchecked
                const wasCompleted = fileTasks.some(storedTask => 
                    storedTask.taskText === task.taskText && storedTask.completed === true
                );
                
                if (wasCompleted) {
                    await this.markTaskUncompleted(filePath, task.taskText);
                }
            }
        }
    }
    
    /**
     * Extract all tasks from a note
     */
    extractTasksFromNote(content: string): Array<{taskText: string, completed: boolean}> {
        const tasks = [];
        
        // Find all tasks (both completed and uncompleted)
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
    
    /**
     * Assess all completed tasks in tracked notes
     */
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
                
                // Count new tasks being assessed
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
        } else {
            new Notice('Scan complete! No new completed tasks found.');
        }
    }

    
    /**
     * Queue a task for assessment with rate limiting
     */
    queueTaskAssessment(filePath: string, taskText: string, tags: string[]): void {
        const task = async () => {
            try {
                // Calculate points for the task
                const points = await this.plugin.calculatePointsForTask(taskText, tags);
                
                // Update stats
                this.plugin.statCardData.points += points;
                this.plugin.statCardData.stats.tasksCompleted++;
                this.plugin.statCardData.stats.totalPointsEarned += points;
                
                // Add to processed tasks
                await this.addProcessedTask(filePath, taskText, points, tags);
                
                // Save data
                await this.plugin.saveStatCardData();
                
                // Update UI
                this.plugin.statCardService.refreshUI();
                
                new Notice(`Task assessed! Earned ${points} points.`);
            } catch (error) {
                console.error("Error assessing task:", error);
                new Notice("Error assessing task. See console for details.");
            }
        };
        
        this.requestQueue.push(task);
        
        // Start processing the queue if it's not already running
        if (!this.isProcessing) {
            this.processQueue();
        }
    }
    
    /**
     * Process the queue with rate limiting
     */
    async processQueue(): Promise<void> {
        if (this.requestQueue.length === 0) {
            this.isProcessing = false;
            return;
        }
        
        this.isProcessing = true;
        
        // Apply rate limiting if enabled
        if (this.plugin.settings.rateLimiting && this.plugin.settings.rateLimiting.enabled) {
            const now = Date.now();
            const minTimeGap = 60000 / this.plugin.settings.rateLimiting.requestsPerMinute;
            const timeElapsed = now - this.lastRequestTime;
            
            if (timeElapsed < minTimeGap) {
                // Wait for the remaining time before making the next request
                await new Promise(resolve => setTimeout(resolve, minTimeGap - timeElapsed));
            }
        }
        
        // Process the next task
        const task = this.requestQueue.shift();
        
        if (task) {
            this.lastRequestTime = Date.now();
            await task();
        }
        
        // Continue processing the queue
        this.processQueue();
    }
    
    /**
     * Handle events for file changes
     */
    async handleFileModified(file: TFile): Promise<void> {
        // Check if this is a tracked note
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