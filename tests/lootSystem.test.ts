import { describe, expect, it } from 'vitest';
import type { LootTableData } from '../src/game/content/schemas';
import { LootSystem } from '../src/game/systems/economy/LootSystem';

function sequence(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

describe('LootSystem', () => {
  it('rolls entries and amounts from deterministic RNG', () => {
    const tables: LootTableData[] = [
      {
        id: 'loot_test',
        entries: [
          { itemId: 'material_iron_ore', chance: 0.6, minAmount: 1, maxAmount: 3 },
          { itemId: 'key_anchor_dust', chance: 0.2, minAmount: 1, maxAmount: 1 }
        ]
      }
    ];

    const loot = new LootSystem(tables);
    const rng = sequence([0.4, 0.8, 0.7]);

    const drops = loot.roll('loot_test', rng);

    expect(drops).toHaveLength(1);
    expect(drops[0]).toEqual({ itemId: 'material_iron_ore', amount: 3 });
  });

  it('returns empty result for unknown tables', () => {
    const loot = new LootSystem([]);

    expect(loot.roll('missing_table')).toEqual([]);
  });
});
