import { describe, expect, it } from 'vitest';
import { migrateSave } from '../src/game/systems/save/migrations';
import type { SaveFileV1 } from '../src/game/systems/save/SaveTypes';

describe('Save migrations', () => {
  it('migrates v1 save to current version', () => {
    const v1: SaveFileV1 = {
      saveVersion: 1,
      timestamp: '2026-02-14T08:00:00.000Z',
      player: {
        level: 4,
        hp: 82,
        maxHp: 100,
        cinders: 220
      },
      inventory: {
        width: 6,
        height: 8,
        slots: [],
        quickbar: [null, null, null, null, null, null, null, null]
      },
      quests: {
        quests: [],
        flags: {}
      },
      worldFlags: {
        gate_gloamwood_unlocked: false
      }
    };

    const migrated = migrateSave(v1);

    expect(migrated.saveVersion).toBe(2);
    expect(migrated.player.stamina).toBe(100);
    expect(migrated.player.maxStamina).toBe(100);
    expect(migrated.player.cinders).toBe(220);
  });

  it('throws for unsupported future versions', () => {
    const futureSave = {
      saveVersion: 3,
      timestamp: '2026-02-14T08:00:00.000Z',
      player: {
        level: 1,
        hp: 100,
        maxHp: 100,
        stamina: 100,
        maxStamina: 100,
        cinders: 0
      },
      inventory: {
        width: 6,
        height: 8,
        slots: [],
        quickbar: [null, null, null, null, null, null, null, null]
      },
      quests: {
        quests: [],
        flags: {}
      },
      worldFlags: {}
    };

    expect(() => migrateSave(futureSave as never)).toThrow('Unsupported future save version');
  });
});
