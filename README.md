# Ash & Aether

Ash & Aether is a browser-first 2D top-down pixel RPG prototype built with TypeScript + Phaser 3.

This repository currently provides a **preproduction + vertical slice foundation**:
- playable top-down scene with movement, collisions, interaction, camera look-ahead, light/heavy attacks, and dodge
- data-driven gameplay modules (inventory, quest state machine, dialogue runtime, save migrations)
- JSON schemas + validator for items, enemies, quests, and dialogues
- automated tests for critical systems
- CI pipeline for build, tests, and content validation

## Quick Start

```bash
npm install
npm run dev
```

Open the local Vite URL (typically `http://localhost:5173`).

## Scripts

```bash
npm run dev              # start dev server
npm run build            # type-check + production build
npm run test:run         # run all tests once
npm run validate:content # validate JSON content against schemas + graph checks
```

## Controls (Prototype)

- Move: `WASD` or arrow keys
- Interact: `E`
- Dodge: `Space`
- Light attack: `J` or left mouse click
- Heavy attack: `K` or right mouse click

## Repository Layout

- `src/game/scenes` - Phaser scenes (boot, overworld, HUD)
- `src/game/systems` - gameplay/domain logic
- `src/game/content` - JSON content + schemas + validator
- `tests` - unit/data tests
- `docs` - architecture and content authoring documentation

## Next Milestone Targets

- enemy AI (`Patrol -> Investigate -> Chase -> Attack -> Retreat`)
- real combat hitboxes/damage windows
- quest journal, inventory UI, map screen
- Tiled map pipeline integration
- boss encounter scripting and cutscene triggers
