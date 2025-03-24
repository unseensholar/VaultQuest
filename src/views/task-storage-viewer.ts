import { App, ButtonComponent, Modal, Setting, TextComponent, TFile, ItemView, WorkspaceLeaf } from 'obsidian';
import GamifyPlugin from '../main';
import { TaskAssessmentService, TaskStateChange } from '../features/task-assessment-service';

export const TASK_STORAGE_VIEW_TYPE = 'task-storage-view';

interface FilterOptions {
    text: string;
    status: 'all' | 'completed' | 'uncompleted';
}

export class TaskStorageViewer extends ItemView {
    private plugin: GamifyPlugin;
    private taskAssessmentService: TaskAssessmentService;
    private container: HTMLElement;
    private textFilter: TextComponent;
    private filterOptions: FilterOptions = {
        text: '',
        status: 'all'
    };
    private activityLogSection: HTMLElement;
    private taskListContainer: HTMLElement;
	
    constructor(leaf: WorkspaceLeaf, plugin: GamifyPlugin, taskAssessmentService: TaskAssessmentService) {
        super(leaf);
        this.plugin = plugin;
        this.taskAssessmentService = taskAssessmentService;
    }

    getViewType(): string {
        return TASK_STORAGE_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Task Storage";
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('vq-task-storage-viewer');
        
        contentEl.createEl('h2', { text: 'Task Storage Viewer' });
        
        this.createFilterSection(contentEl);
        this.createActionButtons(contentEl);
        
        this.activityLogSection = contentEl.createDiv({ cls: 'vq-activity-log-container' });
        this.activityLogSection.createEl('h3', { text: 'Recent Activity' });
        
        this.taskListContainer = contentEl.createDiv({ cls: 'vq-task-list-container' });
        
        this.taskAssessmentService.registerTaskStateListener(this.handleTaskStateChange.bind(this));
        
        await this.refreshView();
    }
    
    private createFilterSection(containerEl: HTMLElement): void {
        const filterContainer = containerEl.createDiv({ cls: 'vq-filter-container' });
        
        this.textFilter = new TextComponent(filterContainer)
            .setPlaceholder('Filter by text or file path')
            .onChange(async (value) => {
                this.filterOptions.text = value;
                await this.renderTaskList();
            });
        
        const statusOptions = [
            { value: 'all', display: 'All' },
            { value: 'completed', display: 'Completed' },
            { value: 'uncompleted', display: 'Uncompleted' }
        ];
        
        new Setting(filterContainer)
            .setName('Status')
            .addDropdown(dropdown => {
                statusOptions.forEach(option => {
                    dropdown.addOption(option.value, option.display);
                });
                dropdown.setValue(this.filterOptions.status);
                dropdown.onChange(async (value: string) => {
                    this.filterOptions.status = value as 'all' | 'completed' | 'uncompleted';
                    await this.renderTaskList();
                });
                return dropdown;
            });
    }
    
    private createActionButtons(containerEl: HTMLElement): void {
        const actionContainer = containerEl.createDiv({ cls: 'vq-action-container' });
        
        new ButtonComponent(actionContainer)
            .setButtonText('Refresh')
            .setClass('mod-primary')
            .onClick(() => this.refreshView());
        
        new ButtonComponent(actionContainer)
            .setButtonText('Clear All Data')
            .setClass('mod-warning')
            .onClick(async () => {
                if (confirm('Are you sure you want to clear all task data? This action cannot be undone.')) {
                    await this.taskAssessmentService.saveTaskStorage([]);
                    await this.refreshView();
                }
            });
    }
    
    private handleTaskStateChange(change: TaskStateChange): void {
        this.refreshView();
    }
    
    private async refreshView(): Promise<void> {
        await Promise.all([
            this.renderActivityLog(),
            this.renderTaskList()
        ]);
    }
    
    private async renderActivityLog(): Promise<void> {
        this.activityLogSection.empty();
        this.activityLogSection.createEl('h3', { text: 'Recent Activity' });
        
        const recentActivity = await this.taskAssessmentService.getRecentTaskActivity(5);
        
        if (recentActivity.length === 0) {
            this.activityLogSection.createEl('p', { text: 'No recent activity.' });
            return;
        }
        
        const activityList = this.activityLogSection.createEl('ul', { cls: 'vq-activity-list' });
        
        for (const activity of recentActivity) {
            const item = activityList.createEl('li', { cls: 'vq-activity-item' });
            
            const statusClass = activity.newState === 'completed' ? 'vq-completed' : 'vq-uncompleted';
            const statusIcon = activity.newState === 'completed' ? '✓' : '○';
            
            const statusIndicator = item.createSpan({ cls: `vq-status ${statusClass}`, text: statusIcon });
            
            const filePathParts = activity.filePath.split('/');
            const fileName = filePathParts[filePathParts.length - 1];
            
            const formattedTime = new Date(activity.timestamp).toLocaleTimeString();
            
            item.createSpan({
                text: ` Task ${activity.newState} at ${formattedTime}: "${this.truncateText(activity.taskText, 40)}" in ${fileName}`
            });
        }
    }
    
    async renderTaskList(): Promise<void> {
        if (!this.taskListContainer) return;
        this.taskListContainer.empty();
        
        const tasks = await this.taskAssessmentService.loadTaskStorage();
        
        const filteredTasks = tasks.filter(task => {
            const textMatch = !this.filterOptions.text || 
                task.taskText.toLowerCase().includes(this.filterOptions.text.toLowerCase()) ||
                task.filePath.toLowerCase().includes(this.filterOptions.text.toLowerCase());
            
            let statusMatch = true;
            if (this.filterOptions.status === 'completed') {
                statusMatch = task.completed;
            } else if (this.filterOptions.status === 'uncompleted') {
                statusMatch = !task.completed;
            }
            
            return textMatch && statusMatch;
        });
        
        filteredTasks.sort((a, b) => b.lastUpdated - a.lastUpdated);
        
        const statsEl = this.taskListContainer.createEl('div', { cls: 'vq-stats-container' });
        statsEl.createEl('p', { 
            text: `Showing ${filteredTasks.length} of ${tasks.length} tasks` 
        });
        
        if (filteredTasks.length === 0) {
            this.taskListContainer.createEl('p', { text: 'No tasks found.' });
            return;
        }
        
        this.createTaskTable(this.taskListContainer, filteredTasks);
    }
    
    private createTaskTable(container: HTMLElement, tasks: any[]): void {
        const table = container.createEl('table', { cls: 'vq-task-table' });
        
        // Create header
        const headerRow = table.createEl('thead').createEl('tr');
        ['Status', 'Task', 'File', 'Points', 'Tags', 'Last Updated', 'Actions']
            .forEach(header => headerRow.createEl('th', { text: header }));
        
        // Create rows
        const tbody = table.createEl('tbody');
        tasks.forEach(task => this.createTaskRow(tbody, task));
    }
    
    private createTaskRow(tbody: HTMLElement, task: any): void {
        const row = tbody.createEl('tr');
        
        const statusCell = row.createEl('td');
        statusCell.createEl('span', { 
            cls: `vq-status ${task.completed ? 'vq-completed' : 'vq-uncompleted'}`,
            text: task.completed ? '✓' : '○'
        });
        
        row.createEl('td', { 
            cls: 'vq-task-text',
            text: this.truncateText(task.taskText, 50)
        }).setAttribute('title', task.taskText);
        
        const filePathParts = task.filePath.split('/');
        const fileName = filePathParts[filePathParts.length - 1];
        row.createEl('td', { text: fileName }).setAttribute('title', task.filePath);
        
        row.createEl('td', { cls: 'vq-points', text: task.points.toString() });
        
        const tagsCell = row.createEl('td', { cls: 'vq-tags' });
        if (task.tags && task.tags.length > 0) {
            task.tags.forEach((tag: string) => {
                tagsCell.createEl('span', { cls: 'vq-tag', text: tag });
            });
        } else {
            tagsCell.setText('None');
        }
        
        const date = new Date(task.lastUpdated);
        row.createEl('td', { 
            text: date.toLocaleDateString() + ' ' + date.toLocaleTimeString() 
        });
        
        const actionsCell = row.createEl('td', { cls: 'vq-actions' });
        new ButtonComponent(actionsCell)
            .setButtonText('Delete')
            .setClass('mod-warning')
            .onClick(async () => {
                if (confirm(`Are you sure you want to delete this task record?`)) {
                    await this.taskAssessmentService.deleteTask(task.filePath, task.taskText);
                    await this.renderTaskList();
                }
            });
    }
    
    private truncateText(text: string, maxLength: number): string {
        return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
    }
    
	async onClose(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class TaskStorageRibbonIcon {
    constructor(plugin: GamifyPlugin, taskAssessmentService: TaskAssessmentService) {
        plugin.addRibbonIcon(
            'list-checks',
            'View Task Storage',
            () => {
                plugin.activateTaskStorageTab();
            }
        );
    }
}
