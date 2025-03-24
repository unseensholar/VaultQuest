export interface GamifyPluginSettings {
    userFavicon?: string;
    xpPerCharacter: number;
    pointsBaseValue: number;
    tagMultipliers: Record<string, number>;
    apiUrl: string;
    apiKey: string;
    themeId: string;
    customTheme?: Theme;
	useStatusBarIndicator: boolean,
	useRibbonIndicator: boolean,	
    trackedNotes: string[];
    selectedLLMModel: string;
	LLM_param: {
		enabled: boolean;
		temp: number;
		max_tokens: number;
		stream: boolean;
	}
    rateLimiting: {
        enabled: boolean;
        requestsPerMinute: number;
    };
    scanInterval: number;
    deductPointsForUnchecking: boolean;
    debugMode: boolean;
    enableInventoryTab: boolean;
    inventoryPositions: Record<string, {row: number, col: number}>;
    ribbonButtons: Record<string, boolean>;
	notification: NotificationListenerSettings;
}

export interface NotificationListenerSettings {
	maxNotificationsToStore: number;
	enableNotificationCapture: boolean;
}
export interface StatCardData {
    xp: number;
    level: number;
    points: number;
    nextLevelXp: number;
    skills: Skill[];
    items: Item[];
    achievements: Achievement[];
    titles: Titles[];
    stats: Stats;
    ownedItems: string[];
    activeEffects: { 
        [key: string]: {
            value: number;
            expiresAt: number;
        }
    };
    activeTheme?: string; 
    hasFamiliar?: boolean;
    lastFamiliarBonusDate?: string;
    writingStats: { totalCharactersTyped: number };
    streaks: { currentStreak: number, longestStreak: number, lastActiveDate: string };
}

export interface Skill {
    id: string;
    name: string;
    level: number;
    xp: number;
}

export interface Item {
    id: string;
    name: string;
    description: string;
    cost: number;
    unlockedAt: string;    
    effect: string[];
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    condition: AchievementCondition;
    reward: AchievementReward;
}

export interface AchievementCondition {
    type: string;
    value: number;
}

export interface AchievementReward {
    type: string;
    value: any;
}
        
export interface Titles {
    id: string;
    name: string;
    description: string;
    unlockedAt: string;
    effect: string[];
}

export interface Stats {
    tasksCompleted: number;
    totalPointsEarned: number;
    highestDifficulty: number;
    tasksUnchecked: number;
    totalPointsDeducted: number;
    itemsPurchased: number;    
    lastFileCount: number;
    lastFolderCount: number;
}

export interface Theme {
    id: string;
    name: string;
    uiElements: {
        grimoire: string;
        level: string;
        points: string;
        xp: string;
        skills: string;
        summonPowers: string;
        tasksCompleted: string;
        redeemButton: string;
        storeButton: string;
        inventory: string,
        settings: string
    };
    flavor: {
        taskSystem: string; 
        pointsSystem: string;
        levelSystem: string;
        systemMessage: string;
    };
}

export interface ItemInfo {
    cost: number;
    effect: string;
}

export interface ItemStore {
    [key: string]: ItemInfo;
}

export interface LLMModel {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}

export interface ProcessedTask {
    filePath: string;
    taskText: string;
    completedOn: string;
}
