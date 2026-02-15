# Data Schemas

## Item

Fields:
- `id`, `name`, `description`, `icon`
- `type`: `consumable | material | weapon | armor | quest | key`
- `rarity`: `Common | Uncommon | Rare | Relic`
- `stackSize`, `value`
- `statsModifiers` (optional)
- `tags`
- `useEffect` (optional)

## Enemy

Fields:
- `id`, `name`
- `hp`, `attack`, `defense`, `speed`
- `lootTableId`, `aiProfileId`
- `animations` (`idle`, `walk`, `attack`, `hurt`, `death`)
- `hitbox` (`width`, `height`, `offsetX`, `offsetY`)

## Quest

Fields:
- `id`, `title`, `description`, `category`
- `prerequisites` (flags + quests)
- `objectives[]`
- `rewards` (`items`, `cinders`, `xp`, `reputation`)
- `onComplete` (flags + region unlocks)

## Dialogue

Fields:
- `conversationId`
- `nodes[]`
- Node fields: `id`, `speakerId`, `portrait`, `text`, `tags`, `conditions`, `effects`, `choices[]`
- Choice fields: `id`, `text`, `nextNodeId`, `conditions`, `effects`

## Validation Rules

- schema type/shape validation for every row
- duplicate ID checks per collection
- cross-reference checks (quest reward items, dialogue `addItem` effects)
- dialogue graph checks:
  - `nextNodeId` must exist
  - cycles are flagged as validation errors
