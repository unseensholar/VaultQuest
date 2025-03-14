import { App, ButtonComponent, Modal, PluginSettingTab, Setting, TextComponent, Notice, TFile } from 'obsidian';
import GamifyPlugin from './main';
import { TaskAssessmentService } from './task-assessment-service';

export class TaskStorageViewer extends Modal {
    private plugin: GamifyPlugin;
    private taskAssessmentService: TaskAssessmentService;
    private textFilter: TextComponent;
    private statusFilter: string = 'all';
    
    constructor(app: App, plugin: GamifyPlugin, taskAssessmentService: TaskAssessmentService) {
        super(app);
        this.plugin = plugin;
        this.taskAssessmentService = taskAssessmentService;
    }
    
    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('vq-task-storage-viewer');
        
        // Header
        contentEl.createEl('h2', { text: 'Task Storage Viewer' });
        
        // Filters
        const filterContainer = contentEl.createDiv({ cls: 'vq-filter-container' });
        
        // Text filter
        this.textFilter = new TextComponent(filterContainer)
            .setPlaceholder('Filter by text or file path')
            .onChange(async (value) => {
                await this.renderTaskList(value, this.statusFilter);
            });
        
        // Completed filter
        const filterOptions = ['all', 'completed', 'uncompleted'];
        new Setting(filterContainer)
            .setName('Status')
            .addDropdown(dropdown => {
                filterOptions.forEach(option => {
                    dropdown.addOption(option, option.charAt(0).toUpperCase() + option.slice(1));
                });
                dropdown.setValue('all');
                dropdown.onChange(async (value) => {
                    this.statusFilter = value;
                    await this.renderTaskList(this.textFilter.getValue(), value);
                });
                return dropdown;
            });
                
        // Action buttons
        const actionContainer = contentEl.createDiv({ cls: 'vq-action-container' });
        
        new ButtonComponent(actionContainer)
            .setButtonText('Refresh')
            .onClick(async () => {
                await this.renderTaskList(this.textFilter.getValue(), this.statusFilter);
            });
        
        new ButtonComponent(actionContainer)
            .setButtonText('Clear All Data')
            .setClass('mod-warning')
            .onClick(async () => {
                if (confirm('Are you sure you want to clear all task data? This action cannot be undone.')) {
                    await this.taskAssessmentService.saveTaskStorage([]);
                    await this.renderTaskList('', 'all');
                }
            });
        
        // Task list container
        contentEl.createDiv({ cls: 'vq-task-list-container' });

        const style = document.createElement('style');
        style.textContent = `
            .vq-task-storage-viewer {
                resize: both;
                overflow: auto;
                max-width: 190vw;
                max-height: 190vh;
                position: relative;
                border: 1px solid #ccc;
                padding: 10px;
            }
        `;
        document.head.appendChild(style);
        
        // Initial render
        await this.renderTaskList('', 'all');
    }
    
    async renderTaskList(textFilter: string, statusFilter: string) {
        const { contentEl } = this;
        const taskListContainer = contentEl.querySelector('.vq-task-list-container');
        if (!taskListContainer) return;
        taskListContainer.empty();
        
        // Load tasks
        const tasks = await this.taskAssessmentService.loadTaskStorage();
        
        // Filter tasks
        const filteredTasks = tasks.filter(task => {
            // Text filter
            const textMatch = !textFilter || 
                task.taskText.toLowerCase().includes(textFilter.toLowerCase()) ||
                task.filePath.toLowerCase().includes(textFilter.toLowerCase());
            
            // Status filter
            let statusMatch = true;
            if (statusFilter === 'completed') {
                statusMatch = task.completed;
            } else if (statusFilter === 'uncompleted') {
                statusMatch = !task.completed;
            }
            
            return textMatch && statusMatch;
        });
        
        // Sort tasks by last updated
        filteredTasks.sort((a, b) => b.lastUpdated - a.lastUpdated);
        
        // Show stats
        const statsEl = taskListContainer.createEl('div', { cls: 'vq-stats-container' });
        statsEl.createEl('p', { 
            text: `Showing ${filteredTasks.length} of ${tasks.length} tasks` 
        });
        
        // Create task list
        if (filteredTasks.length === 0) {
            taskListContainer.createEl('p', { text: 'No tasks found.' });
            return;
        }
        
        const table = taskListContainer.createEl('table', { cls: 'vq-task-table' });
        
        // Headers
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        headerRow.createEl('th', { text: 'Status' });
        headerRow.createEl('th', { text: 'Task' });
        headerRow.createEl('th', { text: 'File' });
        headerRow.createEl('th', { text: 'Points' });
        headerRow.createEl('th', { text: 'Tags' });
        headerRow.createEl('th', { text: 'Last Updated' });
        headerRow.createEl('th', { text: 'Actions' });
        
        // Task rows
        const tbody = table.createEl('tbody');
        
        for (const task of filteredTasks) {
            const row = tbody.createEl('tr');
            
            // Status cell
            const statusCell = row.createEl('td');
            statusCell.createEl('span', { 
                cls: `vq-status ${task.completed ? 'vq-completed' : 'vq-uncompleted'}`,
                text: task.completed ? '✓' : '○'
            });
            
            // Task text cell
            row.createEl('td', { 
                cls: 'vq-task-text',
                text: task.taskText.length > 50 ? task.taskText.slice(0, 50) + '...' : task.taskText
            }).setAttribute('title', task.taskText);
            
            // File path cell
            const filePathParts = task.filePath.split('/');
            const fileName = filePathParts[filePathParts.length - 1];
            row.createEl('td', { text: fileName }).setAttribute('title', task.filePath);
            
            // Points cell
            row.createEl('td', { cls: 'vq-points', text: task.points.toString() });
            
            // Tags cell
            const tagsCell = row.createEl('td', { cls: 'vq-tags' });
            if (task.tags && task.tags.length > 0) {
                for (const tag of task.tags) {
                    tagsCell.createEl('span', { cls: 'vq-tag', text: tag });
                }
            } else {
                tagsCell.setText('None');
            }
            
            // Date cell
            const date = new Date(task.lastUpdated);
            row.createEl('td', { 
                text: date.toLocaleDateString() + ' ' + date.toLocaleTimeString() 
            });
            
            // Actions cell
            const actionsCell = row.createEl('td', { cls: 'vq-actions' });
            
            new ButtonComponent(actionsCell)
                .setButtonText('Go to')
                .setTooltip('Open this file')
                .onClick(() => {
                    // Try to open the file
                    const file = this.app.vault.getAbstractFileByPath(task.filePath);
                    if (file && file instanceof TFile) {
                        const leaf = this.app.workspace.activeLeaf;
                        if (leaf) {
                            leaf.openFile(file);
                        } else {
                            new Notice('No active leaf to open file');
                        }
                    } else {
                        new Notice(`File not found: ${task.filePath}`);
                    }
                });
                
            new ButtonComponent(actionsCell)
                .setButtonText('Delete')
                .setClass('mod-warning')
                .setTooltip('Remove this task from storage')
                .onClick(async () => {
                    if (confirm('Are you sure you want to delete this task from storage?')) {
                        // Remove the task from storage
                        const tasks = await this.taskAssessmentService.loadTaskStorage();
                        const updatedTasks = tasks.filter(t => 
                            !(t.filePath === task.filePath && t.taskText === task.taskText)
                        );
                        await this.taskAssessmentService.saveTaskStorage(updatedTasks);
                        await this.renderTaskList(textFilter, statusFilter);
                    }
                });
        }
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Add this to your main plugin class:
export class TaskStorageRibbonIcon {
    private plugin: GamifyPlugin;
    private taskAssessmentService: TaskAssessmentService;
    
    constructor(plugin: GamifyPlugin, taskAssessmentService: TaskAssessmentService) {
        this.plugin = plugin;
        this.taskAssessmentService = taskAssessmentService;
        
        // Add ribbon icon
        const ribbonIconEl = this.plugin.addRibbonIcon(
            'list-checks',
            'View Task Storage',
            () => {
                new TaskStorageViewer(this.plugin.app, this.plugin, this.taskAssessmentService).open();
            }
        );
    }
}