import { Notice } from 'obsidian';
import GamifyPlugin from '../main';
import { StoreItem } from '../features/itemStore';
import { RedeemTaskModal } from '../core/CoreServices';


export async function initializeStoreItems(plugin: GamifyPlugin): Promise<StoreItem[]> {
    const items: StoreItem[] = [
        {
            id: 'store_app',
            name: 'Commerce Card',
            description: 'Allows you to open the store from the inventory.',
            cost: 10,
            category: 'artifact',
            owned: false,
            levelRequired: 1,
            hidden: false,  
            effect: (plugin: GamifyPlugin) => {
                new Notice('You can now access the store from the inventory!');
            }                
        },
        {
            id: 'theme_toggler',
            name: 'Theme Toggler',
            description: 'Allows you to switch themes.',
            cost: 10,
            category: 'cosmetic',
            owned: false,
            levelRequired: 1,
            hidden: false,  
            effect: (plugin: GamifyPlugin) => {
                new Notice('You can now change themes from the stats menu!');
            }                
        },
        {
            id: 'mysterious_tablet',
            name: 'Mysterious Tablet',
            description: 'A mysterious tablet that resonates with an ethereal hum. It feels like a communicator...?',
            cost: 100,
            category: 'artifact',
            owned: false,
            levelRequired: 0,
            effect: (plugin: GamifyPlugin) => {
                new RedeemTaskModal(plugin.app, plugin).open();
                new Notice('A mysterious tablet falls into your hands. A new icon appears in the Ribbon. A new command enters your mind.');
            }
        },		
        {
            id: 'minor_xp_boost',
            name: 'Experience Potion (Minor)',
            description: 'Gain 100 immediate XP.',
            cost: 25,
            category: 'boost',
            owned: false,
            levelRequired: 0,
            effect: (plugin: GamifyPlugin) => {
                plugin.statCardData.xp += 100;
                new Notice('Your soul absorbs the energy, growing stronger...');
            }
        },
        {
            id: 'major_xp_boost',
            name: 'Experience Potion (Major)',
            description: 'Gain 500 immediate XP.',
            cost: 100,
            category: 'boost',
            owned: false,
            levelRequired: 10,
            hidden: true, 
            effect: (plugin: GamifyPlugin) => {
                plugin.statCardData.xp += 500;
                new Notice('A surge of power courses through your essence!');
            }
        },
        {
            id: 'writing_skill_boost',
            name: 'Quill of Dark Scriptures I',
            description: 'Gain 1 level in Writing skill.',
            cost: 75,
            category: 'boost',
            owned: false,
            skillRequired: { skillId: "writing", level: 2 },
            hidden: false,
            effect: (plugin: GamifyPlugin) => {
                const skill = plugin.statCardData.skills.find(s => s.id === "writing");
                if (skill) {
                    skill.level += 1;
                    new Notice('Your Writing skill has been augmented!');
                }
            }
        },
        {
            id: 'research_skill_boost',
            name: 'Tome of Forbidden Knowledge I',
            description: 'Gain 1 level in Research skill.',
            cost: 75,
            category: 'boost',
            owned: false,
            skillRequired: { skillId: "research", level: 2 },
            hidden: false,
            effect: (plugin: GamifyPlugin) => {
                const skill = plugin.statCardData.skills.find(s => s.id === "research");
                if (skill) {
                    skill.level += 1;
                    new Notice('Your Research skill has been infused with eldritch wisdom!');
                }
            }
        },
        {
            id: 'organization_skill_boost',
            name: 'Cataloguing System I',
            description: 'Gain 1 level in Organization skill.',
            cost: 75,
            category: 'boost',
            owned: false,
            skillRequired: { skillId: "organization", level: 2 },
            hidden: false,
            effect: (plugin: GamifyPlugin) => {
                const skill = plugin.statCardData.skills.find(s => s.id === "organization");
                if (skill) {
                    skill.level += 1;
                    new Notice('Your Organization skill has been enhanced with supernatural precision!');
                }
            }
        },
        {
            id: 'dark_ritual_discount',
            name: 'Blood Pact I',
            description: 'All requests cost 20% less for 24 hours.',
            cost: 150,
            category: 'ritual',
            owned: false,
            levelRequired: 10,
            hidden: false,
            effect: (plugin: GamifyPlugin) => {
                plugin.statCardData.activeEffects = plugin.statCardData.activeEffects || {};
                plugin.statCardData.activeEffects.storeDiscount = {
                    value: 0.2, // 20% discount
                    expiresAt: Date.now() + (24 * 60 * 60 * 1000)
                };
                new Notice('A discount... how quaint...');
            }
        },
        {
            id: 'demonic_theme',
            name: 'Demonic Pact',
            description: 'The Grimoire emits a disturbing light.',
            cost: 200,
            category: 'cosmetic',
            owned: false,
            levelRequired: 5,
            hidden: false,  
            effect: (plugin: GamifyPlugin) => {
                new Notice('You hear the echoes of demonic screams.');
            }
        },			
        {
            id: 'celestial_theme',
            name: 'Celestial Codex',
            description: 'A radiant transformation, aligning your interface with the heavens.',
            cost: 200,
            category: 'cosmetic',
            owned: false,
            levelRequired: 5,
            hidden: false,  
            effect: (plugin: GamifyPlugin) => {
                new Notice('Your interface now shimmers with cosmic brilliance.');
            }
        },
        {
            id: 'cybernetic_theme',
            name: 'Neural Interface',
            description: 'A sleek, high-tech upgrade, turning your UI into a cybernetic control hub.',
            cost: 200,
            category: 'cosmetic',
            owned: false,
            levelRequired: 10,
            hidden: false,  
            effect: (plugin: GamifyPlugin) => {
                new Notice('System update complete. Cybernetic enhancements activated.');
            }
        },
        {
            id: 'arcane_theme',
            name: 'Arcane Tome',
            description: 'A mystical upgrade, bathing your interface in ancient magic.',
            cost: 200,
            category: 'cosmetic',
            owned: false,
            levelRequired: 10,
            hidden: true,  
            effect: (plugin: GamifyPlugin) => {
                new Notice('Arcane glyphs swirl around you as your Tome of Elders awakens.');
            }
        },
        {
            id: 'eldritch_theme',
            name: 'Necronomicon',
            description: 'A disturbing, otherworldly theme, for fans of eldritch horror.',
            cost: 200,
            category: 'cosmetic',
            owned: false,
            levelRequired: 10,
            hidden: true,  
            effect: (plugin: GamifyPlugin) => {
                new Notice('The shadows deepen. You hear whispers in forgotten tongues...');
            }
        },
        {
            id: 'rogue_theme',
            name: "Phantom's Veil",
            description: 'A shadowy, assassin-inspired theme for those who thrive in secrecy.',
            cost: 200,
            category: 'cosmetic',
            owned: false,
            levelRequired: 10,
            hidden: true,  
            effect: (plugin: GamifyPlugin) => {
                new Notice('You vanish into the shadows, your interface adapting to the underworld.');
            }
        },
        {
            id: 'xp_multiplier',
            name: 'Soul Binding Contract',
            description: 'Gain 1.5x XP from all activities for 24 hours.',
            cost: 175,
            category: 'ritual',
            owned: false,
            levelRequired: 15,
            effect: (plugin: GamifyPlugin) => {
                plugin.statCardData.activeEffects = plugin.statCardData.activeEffects || {};
                plugin.statCardData.activeEffects.xpMultiplier = {
                    value: 1.5,
                    expiresAt: Date.now() + (24 * 60 * 60 * 1000)
                };
                new Notice('Your soul now absorbs more energy from your labors...');
            }
        },
        {
            id: 'familiar',
            name: 'Familiar',
            description: 'Summon a small familiar that provides random bonuses each day.',
            cost: 300,
            category: 'artifact',
            owned: false,
            levelRequired: 50,
            hidden: false, 
            effect: (plugin: GamifyPlugin) => {
                plugin.statCardData.hasFamiliar = true;
                setupFamiliarDailyBonus(plugin);
                new Notice('A small creature materializes, bound to your service!');
            }
        },
        {
            id: 'infinite_inventory',
            name: 'Infinite Inventory',
            description: 'A storage tab to store your items.',
            cost: 500,
            category: 'artifact',
            owned: false,
            levelRequired: 1,
            hidden: true,
            effect: (plugin: GamifyPlugin) => {
                new Notice('You bought an Inventory Box!');
            }
        },
        {
            id: 'system_control',
            name: 'Administrative Dominion',
            description: 'Gain administrative access to the system.',
            cost: 500,
            category: 'artifact',
            owned: false,
            levelRequired: 100,
            hidden: false,
            effect: (plugin: GamifyPlugin) => {
                const administratorTitle = {
                    id: "system_control",
                    name: "Administrator",
                    description: "A title given to those with control over the system.",
                    unlockedAt: new Date().toISOString(),
                    effect: [
                        "Grants full access to all system features",
                        "Allows modification of core settings"
                    ]
                };
                if (!plugin.statCardData.titles.some(title => title.id === "system_control")) {
                    plugin.statCardData.titles.push(administratorTitle);
                }
                new Notice('You have been granted Administrator rights!');
            }
        },
        {
            id: 'debugger',
            name: 'Debugger Rights',
            description: 'Unlocks hidden developer tools.',
            cost: 500,
            category: 'artifact',
            owned: false,
            levelRequired: 10,
            hidden: true,
            effect: (plugin: GamifyPlugin) => {
                const debuggerTitle = {
                    id: "debugger",
                    name: "Debugger",
                    description: "A title granted to those who uncover and resolve hidden issues.",
                    unlockedAt: new Date().toISOString(),
                    effect: [
                        "Unlocks hidden developer tools"
                    ]
                };
                if (!plugin.statCardData.titles.some(title => title.id === "debugger")) {
                    plugin.statCardData.titles.push(debuggerTitle);
                }
                
                new Notice('You have been granted Debugger rights!');
            }
        },
        {
            id: 'tagger',
            name: 'Tag Editor',
            description: 'Unlocks ability to add and edit tags.',
            cost: 100,
            category: 'artifact',
            owned: false,
            levelRequired: 3,
            hidden: false,
            effect: (plugin: GamifyPlugin) => {
                new Notice('You have been granted Tag editing rights!');
            }
        }
    ];
    
    await loadCustomItems(plugin, items);
    
    return items;
}

function setupFamiliarDailyBonus(plugin: GamifyPlugin) {
    const now = new Date();
    const today = now.toDateString();
    
    if (plugin.statCardData.lastFamiliarBonusDate !== today) {
        const bonusType = Math.floor(Math.random() * 2);
        const randomBonus = Math.floor(Math.random() * 100);
        
        switch (bonusType) {
            case 0:
                plugin.statCardData.xp += randomBonus;
                new Notice(`Your familiar brings you a gift of ${randomBonus} XP!`);
                break;
            case 1:
                plugin.statCardData.points += randomBonus;
                new Notice(`Your familiar has collected ${randomBonus} tokens for you!`);
                break;
        }
        
        plugin.statCardData.lastFamiliarBonusDate = today;
    }
}

async function loadCustomItems(plugin: GamifyPlugin, items: StoreItem[]) {
    const folderPath = "QuestLog/StoreInventory";
    const files = plugin.app.vault.getFiles().filter(file => 
        file.path.startsWith(folderPath) && file.extension === "json"
    );

    for (const file of files) {
        try {
            const content = await plugin.app.vault.read(file);
            const customItems: StoreItem[] = JSON.parse(content);

            customItems.forEach(item => {
                if (!items.find(existingItem => existingItem.id === item.id)) {
                    items.push({ 
                        ...item, 
                        effect: createEffectFunction(typeof item.effect === 'string' ? item.effect : "")
                    });
                }
            });
        } catch (error) {
            console.error(`Failed to load custom item from ${file.path}:`, error);
        }
    }
}

function createEffectFunction(effect: string): (plugin: GamifyPlugin) => void {
    try {
        return new Function("plugin", effect) as (plugin: GamifyPlugin) => void;
    } catch (error) {
        console.error("Invalid effect code in JSON:", error);
        return () => new Notice("Error executing custom item effect.");
    }
}
