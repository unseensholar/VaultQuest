import { Notice } from 'obsidian';
import GamifyPlugin from '../main';
import { StoreItem } from '../features/itemStore';
import { EffectType, EffectParams } from '../features/effectService';

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
            effectType: 'enable_feature',
            effectParams: {
                featureId: 'store_app'
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
            effectType: 'enable_feature',
            effectParams: {
                featureId: 'theme_toggler'
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
            effectType: 'custom',
            effectParams: {
                customCode: `
					new Notice('A mysterious tablet falls into your hands. A new icon appears in the Ribbon. A new command enters your mind.');
                `
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
            effectType: 'xp_boost',
            effectParams: {
                value: 100
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
            effectType: 'xp_boost',
            effectParams: {
                value: 500
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
            effectType: 'skill_boost',
            effectParams: {
                skillId: "writing",
                value: 1
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
            effectType: 'skill_boost',
            effectParams: {
                skillId: "research",
                value: 1
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
            effectType: 'skill_boost',
            effectParams: {
                skillId: "organization",
                value: 1
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
            effectType: 'store_discount',
            effectParams: {
                value: 0.2,
                duration: 24
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
            effectType: 'custom',
            effectParams: {
                customCode: `new Notice('You hear the echoes of demonic screams.');`
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
            effectType: 'custom',
            effectParams: {
                customCode: `new Notice('Your interface now shimmers with cosmic brilliance.');`
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
            effectType: 'custom',
            effectParams: {
                customCode: `new Notice('System update complete. Cybernetic enhancements activated.');`
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
            effectType: 'custom',
            effectParams: {
                customCode: `new Notice('Arcane glyphs swirl around you as your Tome of Elders awakens.');`
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
            effectType: 'custom',
            effectParams: {
                customCode: `new Notice('The shadows deepen. You hear whispers in forgotten tongues...');`
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
            effectType: 'custom',
            effectParams: {
                customCode: `new Notice('You vanish into the shadows, your interface adapting to the underworld.');`
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
            effectType: 'xp_multiplier',
            effectParams: {
                value: 1.5,
                duration: 24
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
            effectType: 'summon_familiar'
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
            effectType: 'enable_feature',
            effectParams: {
                featureId: 'infinite_inventory'
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
            effectType: 'unlock_title',
            effectParams: {
                titleId: "system_control",
                titleName: "Administrator",
                titleDesc: "A title given to those with control over the system.",
                featureId: "administrator_rights"
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
            effectType: 'unlock_title',
            effectParams: {
                titleId: "debugger",
                titleName: "Debugger",
                titleDesc: "A title granted to those who uncover and resolve hidden issues.",
                featureId: "debugger_tools"
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
            effectType: 'enable_feature',
            effectParams: {
                featureId: 'tagger'
            }
        },
		{
			"id": "experience_stone",
			"name": "Experience Stone",
			"description": "A mystical stone required to craft XP Boost items.",
			"cost": 100,
			"category": "material",
			"owned": false,
			"levelRequired": 20,
			"effectType": "custom",
			"effectParams": {}
		},
		{
			"id": "ritual_gem",
			"name": "Ritual Gem",
			"description": "A gem imbued with ritual energy, essential for crafting Ritual items.",
			"cost": 150,
			"category": "material",
			"owned": false,
			"levelRequired": 15,
			"effectType": "custom",
			"effectParams": {}
		},
		{
			"id": "component",
			"name": "Component",
			"description": "A vital component required to craft Artifact items.",
			"cost": 200,
			"category": "material",
			"owned": false,
			"levelRequired": 10,
			"effectType": "custom",
			"effectParams": {}
		},
		{
			"id": "container",
			"name": "Container",
			"description": "A specialized container used in the crafting of Cosmetic items.",
			"cost": 50,
			"category": "material",
			"owned": false,
			"levelRequired": 0,
			"effectType": "custom",
			"effectParams": {}
		}		
    ];
    
    await loadCustomItems(plugin, items);
    
    return items;
}

async function loadCustomItems(plugin: GamifyPlugin, items: StoreItem[]) {
    const folderPath = "QuestLog/StoreInventory";
    const files = plugin.app.vault.getFiles().filter(file => 
        file.path.startsWith(folderPath) && file.extension === "json"
    );

    for (const file of files) {
        try {
            const content = await plugin.app.vault.read(file);
            const customItems: any[] = JSON.parse(content);

            customItems.forEach(item => {
                if (!items.find(existingItem => existingItem.id === item.id)) {
                    // Convert legacy items to new format if needed
                    const newItem: StoreItem = {
                        ...item,
                        effectType: item.effectType || 'custom',
                        effectParams: item.effectParams || { customCode: typeof item.effect === 'string' ? item.effect : "" }
                    };
                    
                    // Add legacy effect function for backward compatibility
                    if (typeof item.effect === 'string') {
                        newItem.effect = createEffectFunction(item.effect);
                    }
                    
                    items.push(newItem);
                }
            });
        } catch (error) {
            console.error(`Failed to load custom item from ${file.path}:`, error);
        }
    }
}

// Maintain for backward compatibility
function createEffectFunction(effect: string): (plugin: GamifyPlugin) => void {
    return (plugin: GamifyPlugin) => {
        try {            
        } catch (error) {
            console.error("Invalid effect code in JSON:", error);
            new Notice("Error executing custom item effect.");
        }
    };
}