# Ash & Aether

Ash & Aether is a browser-first 2D top-down pixel RPG (TypeScript + Phaser 3).

Current state: **expanded vertical slice foundation** with integrated combat, enemy AI, quests, dialogue, UI screens, and save migrations.

## Implemented Now

- Main menu flow: `Continue / New Game / Settings / Credits`
- Overworld prototype with:
  - 8-direction movement, dodge, block
  - weapon stances: sword / spear / bow
  - light/heavy melee + ranged projectile combat
  - stamina costs and regen
- Enemy AI state machine:
  - `Patrol -> Investigate -> Chase -> Attack (telegraph) -> Retreat`
- Data-driven systems:
  - inventory (6x8 + quickbar)
  - quest state machine
  - dialogue runtime (conditions/effects)
  - perk tree (12 perks, 3 branches)
  - crafting recipes
- UI scenes:
  - HUD
  - Inventory
  - Character + Perks
  - Quest Journal
  - World Map
  - Dialogue panel
- Save system:
  - 3 save slots
  - autosave + manual save
  - migration path up to `saveVersion=3`
- Content pipeline:
  - JSON schemas + validator (items/enemies/quests/dialogues/perks/recipes/regions)
- CI:
  - content validation + tests + build

## Quick Start

```bash
npm install
npm run dev
```

Open local Vite URL (usually `http://localhost:5173`).

## Scripts

```bash
npm run dev
npm run validate:content
npm run test:run
npm run build
```

## Controls

### Gameplay

- Move: `WASD` or arrows
- Interact: `E`
- Dodge: `Space`
- Block: `Shift`
- Light attack: `J` or left mouse
- Heavy attack: `K` or right mouse
- Bow shot: `L` (requires bow stance)
- Weapon stance: `1` sword, `2` spear, `3` bow
- Save: `F5`

### UI

- Inventory: `I`
- Character/Perks: `C`
- Quest Journal: `Q`
- Map: `M`
- Settings: `Esc`

## Repository Layout

- `src/game/scenes` - runtime and UI scenes
- `src/game/systems` - gameplay/domain systems
- `src/game/state` - session/state model
- `src/game/content` - content JSON, schemas, validator
- `tests` - automated tests
- `docs` - architecture and authoring docs

## Next Target

- multi-region map content expansion with scripted dungeons and boss fights
- richer loot/affix generation and shop rotation
- deeper crafting/upgrades and perk unlock UX
- polished pixel art asset pipeline and Tiled integration
