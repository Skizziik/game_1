import { describe, expect, it } from 'vitest';
import { PerkTree } from '../src/game/systems/perks/PerkTree';
import type { PerkDefinition } from '../src/game/state/types';

describe('PerkTree', () => {
  const defs: PerkDefinition[] = [
    {
      id: 'foundry_clean_cut',
      branch: 'Foundry' as const,
      name: 'Clean Cut',
      description: 'attack up',
      maxRank: 3,
      effects: { attack: 2 } as Record<string, number>
    },
    {
      id: 'echo_long_recall',
      branch: 'Echo' as const,
      name: 'Long Recall',
      description: 'crit up',
      maxRank: 2,
      effects: { crit: 0.03 } as Record<string, number>
    }
  ];

  it('spends perk points and accumulates effects', () => {
    const tree = new PerkTree(defs);
    tree.setPoints(3);

    tree.unlock('foundry_clean_cut');
    tree.unlock('foundry_clean_cut');
    tree.unlock('echo_long_recall');

    expect(tree.getPoints()).toBe(0);
    expect(tree.getRank('foundry_clean_cut')).toBe(2);
    expect(tree.getRank('echo_long_recall')).toBe(1);

    const effects = tree.getAllEffects();
    expect(effects.attack).toBe(4);
    expect(effects.crit).toBeCloseTo(0.03);
  });

  it('rejects unlock without points', () => {
    const tree = new PerkTree(defs);

    expect(() => tree.unlock('foundry_clean_cut')).toThrow('Not enough perk points');
  });
});
