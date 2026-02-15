# Content Authoring Guide

## Add a New Item

1. Open `src/game/content/data/items.json`
2. Add a new object with unique `id`
3. Keep `stackSize` and `value` integer
4. Run:

```bash
npm run validate:content
```

## Add a New Quest

1. Open `src/game/content/data/quests.json`
2. Add quest metadata and at least one objective
3. If rewarding items, ensure `itemId` exists in `items.json`
4. Run validator and tests:

```bash
npm run validate:content
npm run test:run
```

## Add a New Dialogue Conversation

1. Open `src/game/content/data/dialogues.json`
2. Add `conversationId` + `nodes`
3. Ensure each choice `nextNodeId` points to an existing node
4. Avoid cycles in node graph unless validator rule is updated intentionally

## Typical Validation Failures

- duplicate IDs in a collection
- unknown reward item references
- dialogue choice points to missing node
- dialogue cycle detected

## Recommended Workflow

1. Edit one content file
2. Run `npm run validate:content`
3. Run `npm run test:run`
4. Commit with scope prefix (example: `content: add mirror marsh enemy set`)
