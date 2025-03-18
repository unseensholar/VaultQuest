import { App, Notice, addIcon } from 'obsidian';
import GamifyPlugin from './main';

const processingIcon = `<svg width="100%" height="100%" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="50 50">
    <animateTransform attributeName="transform" type="rotate" dur="1s" from="0 12 12" to="360 12 12" repeatCount="indefinite"/>
  </circle>
</svg>`;

export class ProcessingIndicatorService {
    private plugin: GamifyPlugin;
    private ribbonIcon: HTMLElement | null = null;
    private isProcessing: boolean = false;
    private taskCount: number = 0;

    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
        addIcon('processing-status', processingIcon);
    }

    initializeUI() {
        this.ribbonIcon = this.plugin.addRibbonIcon('processing-status', 'Processing Tasks', () => {
            new Notice(`${this.taskCount} tasks currently processing`);
        });
        this.hideIndicator();
    }

    startProcessing(taskType: string = 'task') {
        this.taskCount++;
        if (this.ribbonIcon && !this.isProcessing) {
            this.ribbonIcon.style.display = 'flex';
            this.isProcessing = true;
        }
    }

    endProcessing() {
        this.taskCount = Math.max(0, this.taskCount - 1);
        if (this.ribbonIcon && this.taskCount === 0) {
            this.hideIndicator();
        }
    }

    private hideIndicator() {
        if (this.ribbonIcon) {
            this.ribbonIcon.style.display = 'none';
            this.isProcessing = false;
        }
    }
}
