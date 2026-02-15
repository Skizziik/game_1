# Content Authoring Guide

## Data Files

- `src/game/content/data/items.json`
- `src/game/content/data/enemies.json`
- `src/game/content/data/quests.json`
- `src/game/content/data/dialogues.json`
- `src/game/content/data/perks.json`
- `src/game/content/data/recipes.json`
- `src/game/content/data/regions.json`

## Add a New Item

1. Edit `items.json`
2. Add unique `id`
3. Keep `stackSize`/`value` integer
4. Run validator:

```bash
npm run validate:content
```

## Add a New Quest

1. Edit `quests.json`
2. Define metadata + objectives + rewards
3. Ensure reward `itemId` exists in `items.json`
4. Validate:

```bash
npm run validate:content
npm run test:run
```

## Add a New Dialogue Conversation

1. Edit `dialogues.json`
2. Add `conversationId` and nodes
3. Ensure each choice `nextNodeId` exists
4. Keep flow acyclic (validator rejects cycles)

## Add Perks / Recipes / Regions

- Perks: `perks.json` (`branch`, `maxRank`, numeric `effects`)
- Recipes: `recipes.json` (inputs/outputs must reference existing item IDs)
- Regions: `regions.json` (neighbors must reference existing region IDs)

## Typical Validation Failures

- duplicate IDs
- unknown item references in quests/dialogues/recipes
- dialogue edges to missing nodes
- dialogue cycle detected
- region points to missing neighbor

## Recommended Workflow

1. Change one dataset at a time
2. Run `npm run validate:content`
3. Run `npm run test:run`
4. Run `npm run build` before merge/push to mainline
