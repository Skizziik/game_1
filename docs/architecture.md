# Architecture

## Stack

- Engine: Phaser 3
- Language: TypeScript
- Tooling: Vite, Vitest, Zod

## High-Level Layers

1. Core Runtime
- Game bootstrap and scene orchestration (`BootScene`, `OverworldScene`, `HudScene`)
- Input loop, physics, camera follow/look-ahead

2. Gameplay Systems
- `Inventory` (grid + quickbar model)
- `QuestStateMachine` (availability, objective progression, status transitions)
- `DialogueRuntime` (conditions/effects with game-state adapters)
- Save layer (`SaveRepository` + version migrations)

3. Content
- JSON content bundles (`items`, `enemies`, `quests`, `dialogues`)
- Zod schemas + integrity validation (IDs, references, dialogue graph constraints)

4. UI
- In-canvas HUD scene for combat/resources/event feed
- Registry-based data snapshots from gameplay scene to HUD

## Data-Driven Design

Gameplay systems do not hardcode content IDs except in the temporary prototype scene. The production direction is:
- authored content in JSON
- strict schema validation in CI
- runtime loading and dispatch into systems

## Save Versioning Strategy

- Save files include `saveVersion`
- Migrations are incremental (`v1 -> v2 -> ... -> current`)
- Runtime always normalizes to current schema before usage

## Current Boundaries

- Enemy AI and full combat resolution are placeholders
- Prototype map is generated in-scene from simple tile logic
- UI is HUD-only (menu, inventory, map, dialogue screens pending)
