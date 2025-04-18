# VaultQuest - Obsidian Gamification Plugin 🎮✨📜
[![GitHub release (Latest by date)](https://img.shields.io/github/v/release/unseensholar/VaultQuest)](https://github.com/unseensholar/VaultQuest/releases) ![GitHub all releases](https://img.shields.io/github/downloads/unseensholar/VaultQuest/total?color=success)

VaultQuest is an Obsidian plugin that gamifies your note-taking experience by awarding XP and points for writing and completing tasks. Earn XP as you type, level up, and track your progress. 🏆📝🚀

## Why? 🤔
A long time back, I worked on a project to 'gamify' a Discord server with XP gain, text-based battles, and a whole RPG-like system with skills, items, shops, hidden channels, and quests. I had a blast designing the lore and mechanics back then, but trying to get it running again on Discord was tiring.

Since I use Obsidian every day, I tried some of the gamification plugins, but nothing really scratched the itch. So, I figured I’d repurpose my old scripts for something I’d actually use, for myself and anyone else who’d enjoy it.

Now, VaultQuest includes an XP system, reward points, a skill system, and an AI-powered task evaluator. The AI entity determines task difficulty, assigns points, and allows users to spend points for custom AI-generated responses.

---

## Changelog
### v0.6.1 - Patch (Patch 1 @unseensholar in #6)
- Added Level Up Difficulty in Settings. (request by lulunac27a commented Apr 18, 2025)
- Fixes: Issue with Achievements folder creation failing. Added new Achievements to default list.
- Fixes: Issue with Writing skill update showing multiple level up notifications and level rollback.

### v0.6.0 - Major Feature Update
- Added Item Crafter - Menu to create items and add them to the store.
- BRAT support.

### v0.5.2 - Major Enhancements & UI Overhaul

#### Code Improvements & Refactoring  
- Replaced `innerHTML` manipulations with safer **DOM API methods**.  
- Reworked **active view handling** by using `getActiveViewOfType` instead of direct `workspace.activeLeaf` access.  
- Switched to **Vault API** over the Adapter API for better performance.  
- Modularized features for improved **code organization & maintainability**.  
- Major UI elements now styled with **external CSS** for better maintainability.  
- Updated code to align with **Obsidian community guidelines**.  

#### Custom Tags & Skill System  
- Updated the **custom tags** feature. It is now accessible by purchasing the corresponding item from the Item store.
  - Tags cost **10 × multiplier points** (up to a **10× max multiplier**).  
- Fixed **skill leveling bug** and improved logic.  

#### UI/UX Enhancements  
- **Stat Menu Overhaul**: More detailed stat displays.  
- **Ribbon Button** added for quick access to plugin settings.  
- **Achievements Section**:  
  - Moved to an **independent tab view** with improved visualization.  
  - Added a command and ribbon button for quick access.  
- **Task Storage Viewer**: Now displayed in a **tab instead of a window** for a smoother experience.  
- **Improved Inventory System**:  
  - Enhanced visuals.  
  - Enabled **item usage directly from the Inventory tab**.  

#### New Features & Settings  
- **Notification Log**: Keep track of important updates.  
- **Task System Enhancements**:  
  - Implemented **point deduction for unchecked tasks**.  
  - Removed redundant log notifications.
- **More LLM Inference Settings**:  
  - Added **temperature** option.  
  - Added **max response length** option (currently disabled).  
  - Added text streaming option (currently disabled).  
- **Data Persistence**: Added a feature to **save plugin data** if the Obsidian app is force-closed (testing required).  
- **Toggle for Ribbon Buttons** in settings for more customization.  

#### Achievements System Overhaul  
- Achievements now stored in an **"Achievements" folder**.  
- Any JSON file in the correct format is **automatically added** to the achievements list.  

  #### Planned Updates
- [x] **Achievements & Rewards**
- [ ] **More Skill Categories**
- [ ] **Activities and Quests**
- [x] **Item Shop**
- [x] **Theme Engine**
- [ ] **Notification Sounds**
- [x] **Level Up System Improvement**
- [x] **Status Indicators**
- [x]  **LLM Interactions**

---
## Features 🚀
- **XP for Writing**: Gain XP and level up as you type.
- **Task-Based Points**: Earn points for completing tasks, with difficulty-based scoring.
- **Grimoire**: View personal stats in a dedicated panel or status bar.
- **Customizable Settings**: Adjust XP gain, base points per task, and difficulty multipliers.
- **AI-Assisted Task Scoring**: Supports external AI API for assessing task complexity.
- **Skill Progression System**: Gain XP in Writing, Research, and Organization based on activities.
- **AI Summoning System**: Redeem earned points for AI-generated insights or tasks.

## Installation 🔧
1. Download the latest release into your Obsidian `plugins` folder OR use the BRAT plugin.
2. Enable the plugin in Obsidian’s settings.
3. Configure XP, point values, and API settings in the plugin settings menu.

## Usage 📖
### Gaining XP ✍️
- Every typed character contributes XP based on a configurable rate.
- XP is saved and applied to level progression.
- Writing skill levels up based on keystrokes.

### Completing Tasks ✅
- Notes with tasks need to be tracked for monitoring.
- Tasks must be formatted as `- [x] Task description #tag` (tags are optional).
- The plugin scans completed tasks and assigns points based on difficulty.
- Custom difficulty multipliers can be assigned to tags.

### Skills & Progression 📚
- **Writing Skill**: Gains XP based on keystrokes.
- **Research Skill**: Gains XP based on the number of files in the vault.
- **Organization Skill**: Gains XP based on the number of folders created.

### AI Summoning & Requests 🔮
- Points can be redeemed to request AI-generated responses.
- Task cost is determined dynamically by the AI.
- Responses are saved directly to the Obsidian vault.

### Commands 📜
- **Track Current Note for Tasks** – Adds the current note to the tracked list.
- **Remove Note from Task Tracking** – Stops tracking a note.
- **Scan for Completed Tasks** – Manually scan tracked notes for completed tasks.

## Configuration ⚙️
Settings are adjustable via the Obsidian plugin settings panel:
- **XP per Character** – Adjust XP gain per keystroke.
- **Base Points per Task** – Set the default point value for task completion.
- **Tag Multipliers** – Customize point gains based on task tags.
- **API URL & Key** – Configure the AI API endpoint.

## Data Storage 💾
- XP, levels, and stats are stored in `QuestLog/data.json`.
- Processed tasks are stored in `QuestLog/tasks.json`.
- AI-generated responses are saved in the `QuestLog/` directory.

## Future Enhancements 🛠️
- **Achievements & Rewards**
- **Expanded Skill Categories**
- **Interactive Quests & Challenges**
- **Item Store & Economy System**

## Bug Fixes 🐞
- [x] Bug fix: Checking multiple tasks in rapid succession bugs out the tag update feature.
- [x] Bug fix: Handling of invalid LLM response and fallback system.

## Support me

Your feedback is all I need.
