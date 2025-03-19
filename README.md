# VaultQuest - Obsidian Gamification Plugin 🎮✨📜
[![GitHub release (Latest by date)](https://img.shields.io/github/v/release/unseensholar/VaultQuest)](https://github.com/unseensholar/VaultQuest/releases) ![GitHub all releases](https://img.shields.io/github/downloads/unseensholar/VaultQuest/total?color=success)

VaultQuest is an Obsidian plugin that gamifies your note-taking experience by awarding XP and points for writing and completing tasks. Earn XP as you type, level up, and track your progress. 🏆📝🚀

## Why? 🤔
A long time back, I worked on a project to 'gamify' a Discord server with XP gain, text-based battles, and a whole RPG-like system with skills, items, shops, hidden channels, and quests. I had a blast designing the lore and mechanics back then, but trying to get it running again on Discord was tiring.

Since I use Obsidian every day, I tried some of the gamification plugins, but nothing really scratched the itch. So, I figured I’d repurpose my old scripts for something I’d actually use, for myself and anyone else who’d enjoy it.

Now, VaultQuest includes an XP system, reward points, a skill system, and an AI-powered task evaluator. The AI entity determines task difficulty, assigns points, and allows users to spend points for custom AI-generated responses.

---

## Changelog
### !!! MAJOR RELEASE v0.4.0!!!
#### UI & UX Enhancements
- Redesigned Progress Window in plugin settings.
- Redesigned Stats Window for better readability.
- Reworked Status Card to display items, achievements, titles, and effects.
- Redesigned Store UI for a smoother experience.
- Process Indicator added to ribbon for better UX feedback.
- Refresh UI Button added to ribbon.
- Usage Instructions updated.

#### New Features
- Unlockable Theme Switcher added with new themes available in the store.
- Inventory Tab added to showcase owned items.
- Achievements System implemented with default and custom achievements. Instructions will be provided.
- Titles added to the Item Store to enhance customization.
- Custom Store Items introduced for personalized game elements.
- Level-Up Rewards updated for better progression balance.

#### Functional & Command Improvements
- LLM Request Button added to the ribbon for quick AI interactions.
- Store Access Button moved to ribbon and corresponding command added.
- Added Debug Menu for troubleshooting.

#### Bug Fixes & Data Handling
- Data storage location moved to `QuestLog` folder in root directory.
- Fixed data saving bug that occasionally caused resets (user feedback required).
- Temporarily disabled item usage from Inventory Tab (pending refinement).

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
### v0.3.0 - Major Update

#### New Features
- **Item Store System**  
  - Added an Item Store Service, allowing users to redeem items and effects using reward points.
  - Added Timed Effects: Timed active effects (buffs) added to Item Store.
  
- **LLM Model Configuration**  
  - Added persistent configuration options for LLM in settings. When used with LM studio, the saved LLM model will be automatically loaded and used if the option is enabled.
  
- **Added Commands**  
  - Integrated new commands into the Obsidian command palette and ribbon.

#### Improvements
- **Reworked Task Tracking & Reward System**  
  - Overhauled the underlying logic for task tracking and reward allocation.
  
- **Codebase Refactoring & Module Initialization**  
  - Refactored significant portions of the code for enhanced maintainability.

#### Bug Fixes
- Addressed various minor bugs affecting state management and event handling to ensure a more stable and reliable user experience.

#### Planned Updates
- [ ] **Achievements & Rewards**
- [ ] **More Skill Categories**
- [ ] **Activities and Quests**
- [x] **Item Shop**
- [ ] **Theme Engine**
- [ ] **Notification Sounds**
- [ ] **Level Up System Improvement**
- [ ] **Status Indicators**
- [ ] **LLM Interactions**

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
1. Clone the repo into your Obsidian `plugins` folder.
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
- XP, levels, and stats are stored in `VQ/data.json`.
- Processed tasks are stored in `VQ/tasks.json`.
- AI-generated responses are saved in the `VQ/` directory.

## Future Enhancements 🛠️
- **Achievements & Rewards**
- **Expanded Skill Categories**
- **Interactive Quests & Challenges**
- **Item Store & Economy System**

## Bug Fixes 🐞
- [x] Bug fix: Checking multiple tasks in rapid succession bugs out the tag update feature.
- [x] Bug fix: Handling of invalid LLM response and fallback system.

## Support me

<a href='https://ko-fi.com/unseenscholar' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi1.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
