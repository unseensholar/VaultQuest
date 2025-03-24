import { App, Modal, Notice } from 'obsidian';
import GamifyPlugin from '../main';


export class DebugMenu extends Modal {
    plugin: GamifyPlugin;

    constructor(app: App, plugin: GamifyPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: "Debug Menu" });

        this.createStatsSection(contentEl);
        this.createSkillsSection(contentEl);
        this.createItemsSection(contentEl);
        this.createStatsManipulationSection(contentEl);
        this.createTitlesSection(contentEl);
        this.createDebugTools(contentEl);

        const saveBtn = contentEl.createEl("button", { 
            text: "Save All Changes", 
            cls: "mod-cta debug-button"
        });
        saveBtn.addEventListener("click", async () => {
            await this.plugin.saveStatCardData();
            new Notice("Debug changes saved successfully!");
            this.close();
        });
    }

    createStatsSection(parent: HTMLElement) {
        const section = parent.createDiv("debug-section");
        section.createEl("h3", { text: "Core Stats" });

        this.createStatControl(section, "XP", () => this.plugin.statCardData.xp, (val) => { 
            this.plugin.statCardData.xp = val; 
            this.plugin.checkForLevelUp();
        });

        this.createStatControl(section, "Level", () => this.plugin.statCardData.level, (val) => { 
            this.plugin.statCardData.level = val; 
            this.plugin.statCardData.nextLevelXp = Math.round(100 * Math.pow(1.1 + val * 0.05, val - 1));
        });

        this.createStatControl(section, "Points", () => this.plugin.statCardData.points, (val) => {
            this.plugin.statCardData.points = val;
        });
    }

    createSkillsSection(parent: HTMLElement) {
        const section = parent.createDiv("debug-section");
        section.createEl("h3", { text: "Skills" });

        const skillSelector = section.createEl("select");
        this.plugin.statCardData.skills.forEach(skill => {
            const option = skillSelector.createEl("option");
            option.value = skill.id;
            option.text = skill.name;
        });

        const selectedSkillDiv = section.createDiv("selected-skill-controls");

        const updateSelectedSkillControls = () => {
            const selectedSkillId = skillSelector.value;
            const selectedSkill = this.plugin.statCardData.skills.find(s => s.id === selectedSkillId);
            if (!selectedSkill) return;

            selectedSkillDiv.empty();
            this.createStatControl(selectedSkillDiv, "Skill Level", () => selectedSkill.level, (val) => selectedSkill.level = val);
            this.createStatControl(selectedSkillDiv, "Skill XP", () => selectedSkill.xp, (val) => selectedSkill.xp = val);
        };

        skillSelector.addEventListener("change", updateSelectedSkillControls);
        updateSelectedSkillControls();
    }

    createItemsSection(parent: HTMLElement) {
        const section = parent.createDiv("debug-section");
        section.createEl("h3", { text: "Owned Items" });

        const itemInputContainer = section.createDiv("item-input-container");
        const itemInput = itemInputContainer.createEl("input", {
            type: "text",
            placeholder: "Enter item id to add"
        });

        const addItemButton = itemInputContainer.createEl("button", { text: "Add Item", cls: "debug-button" });
        addItemButton.addEventListener("click", () => {
            const itemId = itemInput.value.trim();
            if (itemId && !this.plugin.statCardData.ownedItems.includes(itemId)) {
                this.plugin.statCardData.ownedItems.push(itemId);
                this.renderOwnedItems(itemsListDiv);
                itemInput.value = '';
            }
        });

        const itemsListDiv = section.createDiv("items-list");
        this.renderOwnedItems(itemsListDiv);
    }

    createStatsManipulationSection(parent: HTMLElement) {
        const section = parent.createDiv("debug-section");
        section.createEl("h3", { text: "Stats & Counters" });

        this.createStatControl(section, "Tasks Completed", () => this.plugin.statCardData.stats.tasksCompleted, (val) => this.plugin.statCardData.stats.tasksCompleted = val);
        this.createStatControl(section, "Total Points Earned", () => this.plugin.statCardData.stats.totalPointsEarned, (val) => this.plugin.statCardData.stats.totalPointsEarned = val);
    }

    createTitlesSection(parent: HTMLElement) {
        const section = parent.createDiv("debug-section");
        section.createEl("h3", { text: "Manage Titles" });

        const titleIdInput = section.createEl("input", { type: "text", placeholder: "Enter Title ID" });
        const titleNameInput = section.createEl("input", { type: "text", placeholder: "Enter Title Name" });
        const titleDescInput = section.createEl("input", { type: "text", placeholder: "Enter Title Description" });

        const addTitleButton = section.createEl("button", { text: "Add Title", cls: "debug-button" });

        addTitleButton.addEventListener("click", () => {
            const id = titleIdInput.value.trim();
            const name = titleNameInput.value.trim();
            const description = titleDescInput.value.trim();

            if (!id || !name || !description) {
                new Notice("Please fill in all fields before adding a title.");
                return;
            }

            if (this.plugin.statCardData.titles.some(title => title.id === id)) {
                new Notice(`Title "${name}" already exists.`);
                return;
            }

            const newTitle = {
                id,
                name,
                description,
                unlockedAt: new Date().toISOString(),
                effect: []
            };

            this.plugin.statCardData.titles.push(newTitle);

            this.renderTitlesList(titlesListDiv);
            titleIdInput.value = "";
            titleNameInput.value = "";
            titleDescInput.value = "";
        });

        const titlesListDiv = section.createDiv("titles-list");
        this.renderTitlesList(titlesListDiv);
    }

    createDebugTools(parent: HTMLElement) {
        const section = parent.createDiv("debug-section");
        section.createEl("h3", { text: "Debug Tools" });

        const forceSaveBtn = section.createEl("button", { text: "Force Save Data", cls: "debug-button" });
        forceSaveBtn.addEventListener("click", async () => {
            await this.plugin.saveStatCardData();
            new Notice("Data force-saved successfully");
        });
    }

    createStatControl(containerEl: HTMLElement, label: string, getValue: () => number, setValue: (val: number) => void) {
        const controlDiv = containerEl.createDiv("stat-control");

        const labelEl = controlDiv.createEl("span", { text: label, cls: "stat-label" });

        const buttonContainer = controlDiv.createDiv("stat-button-container");

        const buttons = [
            { text: "-10", change: -10, cls: "decrease-button" },
            { text: "-1", change: -1, cls: "decrease-button" },
            { text: "+1", change: 1, cls: "increase-button" },
            { text: "+10", change: 10, cls: "increase-button" }
        ];

        const leftButtonGroup = buttonContainer.createDiv("stat-button-group");
        buttons.slice(0, 2).forEach(({ text, change, cls }) => {
            const btn = leftButtonGroup.createEl("button", { text, cls: `debug-button ${cls}` });
            btn.addEventListener("click", () => {
                const newVal = Math.max(0, getValue() + change);
                setValue(newVal);
                valueSpan.textContent = `${newVal}`;
            });
        });

        const valueSpan = buttonContainer.createEl("span", { text: `${getValue()}`, cls: "stat-value" });

        const rightButtonGroup = buttonContainer.createDiv("stat-button-group");
        buttons.slice(2).forEach(({ text, change, cls }) => {
            const btn = rightButtonGroup.createEl("button", { text, cls: `debug-button ${cls}` });
            btn.addEventListener("click", () => {
                const newVal = Math.max(0, getValue() + change);
                setValue(newVal);
                valueSpan.textContent = `${newVal}`;
            });
        });
    }

    renderOwnedItems(containerEl: HTMLElement) {
        containerEl.empty();
        this.plugin.statCardData.ownedItems.forEach(itemId => {
            const div = containerEl.createDiv("owned-item");
            div.createEl("span", { text: itemId });

            const removeBtn = div.createEl("button", { text: "Remove", cls: "debug-button" });
            removeBtn.addEventListener("click", () => {
                this.plugin.statCardData.ownedItems = this.plugin.statCardData.ownedItems.filter(id => id !== itemId);
                this.renderOwnedItems(containerEl);
            });
        });
    }

    renderTitlesList(containerEl: HTMLElement) {
        containerEl.empty();

        if (this.plugin.statCardData.titles.length === 0) {
            containerEl.createEl("p", { text: "No titles unlocked yet.", cls: "debug-empty-message" });
            return;
        }

        this.plugin.statCardData.titles.forEach(title => {
            const titleDiv = containerEl.createDiv("title-item");

            titleDiv.createEl("h4", { text: title.name });

            titleDiv.createEl("p", { text: title.description, cls: "title-description" });

            const unlockDate = new Date(title.unlockedAt).toLocaleDateString();
            titleDiv.createEl("p", { text: `Unlocked on: ${unlockDate}`, cls: "title-unlock-date" });

            if (title.effect.length > 0) {
                const effectsList = titleDiv.createEl("ul", { cls: "title-effects-list" });
                title.effect.forEach(effect => {
                    effectsList.createEl("li", { text: effect });
                });
            }

            const removeBtn = titleDiv.createEl("button", { text: "Remove", cls: "debug-button" });
            removeBtn.addEventListener("click", () => {
                this.plugin.statCardData.titles = this.plugin.statCardData.titles.filter(t => t.id !== title.id);
                this.renderTitlesList(containerEl);
            });

            titleDiv.appendChild(removeBtn);
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
