import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, moment } from 'obsidian';
import { GamifyPluginSettings, NotificationListenerSettings } from '../core/types';

interface StoredNotification {
  text: string;
  timestamp: string;
}

export class NotificationModal extends Modal {
  private notificationListener: NotificationListener;

  constructor(app: App, notificationListener: NotificationListener) {
    super(app);
    this.notificationListener = notificationListener;
  }

  onOpen() {
    const { contentEl } = this;
    this.createNotificationViewer(contentEl);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private createNotificationViewer(containerEl: HTMLElement): void {
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Notification History' });
  
    const notifications = this.notificationListener.getNotifications();
    
    const notificationContainer = containerEl.createEl('div', { cls: 'notification-container' });
  
    if (notifications.length === 0) {
      notificationContainer.createEl('p', { 
        text: 'No notifications have been captured yet.',
        cls: 'no-notifications' 
      });
      return;
    }
  
    notifications.forEach(notification => {
      const card = notificationContainer.createEl('div', { cls: 'notification-card' });
      
      card.createEl('div', { 
        text: notification.text,
        cls: 'notification-message' 
      });
      
      // Timestamp
      card.createEl('div', { 
        text: notification.timestamp,
        cls: 'notification-timestamp' 
      });
    });
  }
}

export class NotificationListener {
  private observers: MutationObserver[] = [];
  private storedNotifications: StoredNotification[] = [];
  private settings: NotificationListenerSettings;
  private plugin: Plugin;
  private app: App;

  constructor(plugin: Plugin, settings: NotificationListenerSettings) {
    this.plugin = plugin;
    this.settings = settings;
    this.app = plugin.app;
  }

  public initialize(): void {
    const parent = document.querySelector('body') as Node;
    this.startObserving(parent, 'notice');
  }

  public cleanup(): void {
    this.observers.forEach((obs) => {
      obs.disconnect();
    });
    this.observers = [];
  }

  private startObserving(domNode: Node, classToLookFor: string): void {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        const elementAdded = Array.from(mutation.addedNodes).some(
          element => {
            if ((element as Element).classList) {
              return (element as Element).classList.contains(classToLookFor);
            }
            return false;
          }
        );

        if (elementAdded && this.settings.enableNotificationCapture) {
          mutation.addedNodes.forEach((notice) => {
            if ((notice as Element).classList?.contains(classToLookFor)) {
              this.captureNotification(notice.textContent || '');
            }
          });
        }
      });
    });

    observer.observe(domNode, {
      childList: true,
      attributes: false,
      characterData: false,
      subtree: true,
    });

    this.observers.push(observer);
  }

  private captureNotification(text: string): void {
    if (!text || /^\d+$/.test(text.trim())) {
      return;
    }
  
    const messagesToIgnore = [
      "Scan complete! No new completed tasks found.",
      "Manual scan started.",
      "0 tasks currently processing",
      "Connection successful!",
    ];
  
    if (messagesToIgnore.includes(text.trim())) {
      return;
    }
  
    const notification: StoredNotification = {
      text: text,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    };

    this.storedNotifications.unshift(notification);
  
    if (this.storedNotifications.length > this.settings.maxNotificationsToStore) {
      this.storedNotifications = this.storedNotifications.slice(
        0, this.settings.maxNotificationsToStore
      );
    }

    this.saveNotifications();
  }
  private async saveNotifications(): Promise<void> {
    const existingData = await this.plugin.loadData() || {};
    await this.plugin.saveData({ 
      ...existingData,
      notifications: this.storedNotifications
    });
  }

  public async loadNotifications(): Promise<void> {
    const data = await this.plugin.loadData();
    this.storedNotifications = data?.notifications || [];
  }

  public getNotifications(): StoredNotification[] {
    return this.storedNotifications;
  }

  public clearNotifications(): void {
    this.storedNotifications = [];
    this.saveNotifications();
  }

  public getLastNotifications(count: number): StoredNotification[] {
    return this.storedNotifications.slice(0, count);
  }
  
  public openNotificationModal(): void {
    new NotificationModal(this.app, this).open();
  }
}

export function addNotificationSettingsUI(containerEl: HTMLElement, plugin: Plugin, notificationListener: NotificationListener, settings: NotificationListenerSettings, saveSettings: () => Promise<void>): void {

  new Setting(containerEl)
    .setName('Enable notification capture')
    .setDesc('Capture and store notifications for later viewing')
    .addToggle(toggle => toggle
      .setValue(settings.enableNotificationCapture)
      .onChange(async value => {
        settings.enableNotificationCapture = value;
        await saveSettings();
      }));

  new Setting(containerEl)
    .setName('Maximum notifications to store')
    .setDesc('Set the number of most recent notifications to keep')
    .addSlider(slider => slider
      .setLimits(10, 500, 10)
      .setValue(settings.maxNotificationsToStore)
      .setDynamicTooltip()
      .onChange(async value => {
        settings.maxNotificationsToStore = value;
        await saveSettings();
      }));

  new Setting(containerEl)
    .setName('View notification history')
    .setDesc('Open a window showing all captured notifications')
    .addButton(button => button
      .setButtonText('View History')
      .onClick(() => {
        notificationListener.openNotificationModal();
      }));

  new Setting(containerEl)
    .setName('Clear stored notifications')
    .setDesc('Remove all currently stored notifications')
    .addButton(button => button
      .setButtonText('Clear')
      .onClick(() => {
        notificationListener.clearNotifications();
        new Notice('Notification history cleared');
      }));
}