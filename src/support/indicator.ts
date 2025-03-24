import { Plugin, addIcon, setIcon } from 'obsidian';
import GamifyPlugin from '../main';

export class ProcessingIndicatorService {
    private plugin: GamifyPlugin;
    private statusBarItem: HTMLElement | null = null;
    private ribbonIconEl: HTMLElement | null = null;
    private isProcessing: boolean = false;
    private animationInterval: number | null = null;
    private dots: number = 0;
    private processingType: string | null = null;

    constructor(plugin: GamifyPlugin) {
        this.plugin = plugin;
        this.initializeIcons();
        this.createStatusBarItem();
    }

    private initializeIcons() {
        addIcon('processing-indicator', `<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round">
                <animate attributeName="stroke-dasharray" from="0 283" to="283 0" dur="1.5s" repeatCount="indefinite"/>
                <animate attributeName="stroke-dashoffset" from="0" to="-283" dur="1.5s" repeatCount="indefinite"/>
            </circle>
        </svg>`);
    }

    private createStatusBarItem() {
        this.statusBarItem = this.plugin.addStatusBarItem();
        this.statusBarItem.addClass('processing-indicator-status');
        this.statusBarItem.style.display = 'none';
    }

    private createRibbonIcon() {
        this.ribbonIconEl = this.plugin.addRibbonIcon('processing-indicator', 'Processing', () => {
            return;
        });
        this.ribbonIconEl.addClass('processing-indicator-ribbon');
    }

    public startProcessing(type: string = 'default') {
        this.isProcessing = true;
        this.processingType = type;
        this.dots = 0;

        if (this.plugin.settings.useStatusBarIndicator !== false) {
            this.showStatusBarIndicator();
        }

        if (this.plugin.settings.useRibbonIndicator !== false) {
            this.createRibbonIcon();
            this.showRibbonIndicator();
        }

        if (this.animationInterval === null) {
            this.animationInterval = window.setInterval(() => {
                this.updateAnimation();
            }, 500);
        }
    }

    private showStatusBarIndicator() {
        if (!this.statusBarItem) return;

        const theme = this.plugin.themeService.getCurrentTheme();
        const label = this.getProcessingLabel(theme);
        this.statusBarItem.setText(label);
        this.statusBarItem.style.display = 'block';
    }

    private showRibbonIndicator() {
        if (!this.ribbonIconEl) return;

        this.ribbonIconEl.style.display = 'block';
        this.ribbonIconEl.setAttribute('aria-label', this.getProcessingText());
    }

    private getProcessingLabel(theme: any): string {
        let baseText = '';
        
        if (this.processingType === 'llm') {
            baseText = theme?.flavor?.processingMessage || 'Consulting the powers';
        } else {
            baseText = 'Processing';
        }
        
        return baseText + '.'.repeat(this.dots);
    }

    private getProcessingText(): string {
        if (this.processingType === 'llm') {
            return 'Consulting mystical powers...';
        }
        return 'Processing...';
    }

    private updateAnimation() {
        if (!this.isProcessing) return;

        const theme = this.plugin.themeService.getCurrentTheme();
        this.dots = (this.dots + 1) % 4;

        if (this.statusBarItem && this.plugin.settings.useStatusBarIndicator !== false) {
            this.statusBarItem.setText(this.getProcessingLabel(theme));
        }

        if (this.ribbonIconEl && this.plugin.settings.useRibbonIndicator !== false && this.isProcessing) {
            const rotation = (Date.now() / 10) % 360;
            this.ribbonIconEl.style.transform = `rotate(${rotation}deg)`;
        }
    }

    public endProcessing() {
        this.isProcessing = false;
        this.processingType = null;

        if (this.animationInterval !== null) {
            window.clearInterval(this.animationInterval);
            this.animationInterval = null;
        }

        if (this.statusBarItem) {
            this.statusBarItem.style.display = 'none';
        }

        if (this.ribbonIconEl) {
            this.ribbonIconEl.remove();
            this.ribbonIconEl = null;
        }
    }

    public destroy() {
        this.endProcessing();
        
        if (this.statusBarItem) {
            this.statusBarItem.remove();
            this.statusBarItem = null;
        }
    }
}