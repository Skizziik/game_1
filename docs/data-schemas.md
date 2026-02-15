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
- node fields: `id`, `speakerId`, `portrait`, `text`, `tags`, `conditions`, `effects`, `choices[]`
- choice fields: `id`, `text`, `nextNodeId`, `conditions`, `effects`

## Perk

Fields:
- `id`, `branch`, `name`, `description`, `maxRank`
- `effects` (`Record<string, number>`)

## Recipe

Fields:
- `id`, `name`, `station`
- `output` (`itemId`, `amount`, `maxStack`, `tags`)
- `cost[]` (`itemId`, `amount`)
- `cindersCost`

## Region

Fields:
- `id`, `name`, `biome`, `recommendedLevel`
- `neighbors[]`
- `signaturePuzzle`

## Validation Rules

- schema type/shape validation for every row
- duplicate ID checks per collection
- cross-reference checks:
  - quest reward items
  - dialogue `addItem` effects
  - recipe input/output item IDs
  - region neighbor IDs
- dialogue graph checks:
  - `nextNodeId` must exist
  - cycles are validation errors
