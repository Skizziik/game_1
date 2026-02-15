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

    expect(migrated.saveVersion).toBe(3);
    expect(migrated.session.player.stamina).toBe(100);
    expect(migrated.session.player.maxStamina).toBe(100);
    expect(migrated.session.cinders).toBe(220);
    expect(migrated.session.player.level).toBe(4);
  });

  it('throws for unsupported future versions', () => {
    const futureSave = {
      saveVersion: 4,
      timestamp: '2026-02-14T08:00:00.000Z',
      session: {
        player: {
          level: 1,
          xp: 0,
          xpToNext: 100,
          hp: 100,
          maxHp: 100,
          stamina: 100,
          maxStamina: 100,
          attack: 12,
          defense: 6,
          crit: 0.05,
          moveSpeed: 145
        },
        cinders: 0,
        equipment: {
          weapon: null,
          offhand: null,
          armor: null,
          trinkets: [null, null],
          weaponMode: 'sword'
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
        worldFlags: {},
        reputations: {
          archivists: 0,
          pilgrims: 0,
          foundry: 0
        },
        perks: {
          points: 0,
          ranks: {}
        },
        regions: {
          unlocked: ['cinderhaven'],
          discovered: ['cinderhaven']
        },
        eventLog: [],
        timestamp: '2026-02-14T08:00:00.000Z'
      }
    };

    expect(() => migrateSave(futureSave as never)).toThrow('Unsupported future save version');
  });
});
