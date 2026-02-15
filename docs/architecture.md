# Architecture

## Stack

- Engine: Phaser 3
- Language: TypeScript
- Tooling: Vite, Vitest, Zod

## Runtime Scenes

- `BootScene` - runtime bootstrap + generated placeholder textures
- `MainMenuScene` - continue/new/settings/credits flow
- `OverworldScene` - exploration, combat, interactions, quest progression
- `HudScene` - combat/resources/quickbar/event feed
- `InventoryScene` - inventory tabs and equipment display
- `CharacterScene` - stats/perks/reputation view
- `QuestJournalScene` - quest tracking panel
- `WorldMapScene` - region discovery/unlock visualization
- `DialogueScene` - conversation choices + keyboard/mouse selection
- `SettingsMenuScene` / `CreditsScene` - utility screens

## Gameplay Systems

- `GameSession` (single source of truth)
  - player stats and progression
  - cinders, flags, reputations, region discovery
  - inventory + quests + perks integration
  - quest rewards and content indexing
- `Inventory` - stackable item model with quickbar assignment
- `QuestStateMachine` - lock/available/active/completed/failed lifecycle
- `DialogueRuntime` - conditional choices and stateful effects
- `EnemyController` - finite-state AI with telegraphed attacks
- `CraftingSystem` - station recipes with material/currency checks
- Save layer (`SaveRepository` + migrations)

## Data-Driven Content

Content lives under `src/game/content/data`:

- `items.json`
- `enemies.json`
- `quests.json`
- `dialogues.json`
- `perks.json`
- `recipes.json`
- `regions.json`

Validation (`validateContent`) enforces:

- schema integrity for each dataset
- duplicate ID checks
- cross-reference checks (quest rewards, recipe inputs/outputs, dialogue item effects)
- dialogue graph correctness (missing nodes + cycle detection)
- region neighbor integrity

## Save Versioning

Current version: `3`

- `v1 -> v2`: add stamina fields
- `v2 -> v3`: migrate to session snapshot model

Runtime always normalizes saves via `migrateSave` before use.
