import { describe, expect, it } from 'vitest';
import { defaultContent } from '../src/game/content/defaultContent';
import { validateContent } from '../src/game/content/validateContent';

describe('Content validation', () => {
  it('validates bundled content data', () => {
    const result = validateContent(defaultContent);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.parsed?.items.length).toBeGreaterThan(0);
  });

  it('detects cycles in dialogue graph', () => {
    const result = validateContent({
      ...defaultContent,
      dialogues: [
        {
          conversationId: 'cycle_case',
          nodes: [
            {
              id: 'start',
              speakerId: 'npc_a',
              text: 'A',
              choices: [{ id: 'to_b', text: 'B', nextNodeId: 'b' }]
            },
            {
              id: 'b',
              speakerId: 'npc_b',
              text: 'B',
              choices: [{ id: 'to_start', text: 'Back', nextNodeId: 'start' }]
            }
          ]
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((entry) => entry.includes('contains a cycle'))).toBe(true);
  });

  it('detects enemies that reference missing loot tables', () => {
    const result = validateContent({
      ...defaultContent,
      enemies: defaultContent.enemies.map((enemy, index) =>
        index === 0 ? { ...enemy, lootTableId: 'loot_missing' } : enemy
      )
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((entry) => entry.includes('unknown loot table'))).toBe(true);
  });
});
