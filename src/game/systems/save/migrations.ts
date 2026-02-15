import { CURRENT_SAVE_VERSION } from './SaveTypes';
import type { SaveFile, SaveFileV1, SaveFileV2, SaveFileV3 } from './SaveTypes';

function isSaveV1(input: SaveFile): input is SaveFileV1 {
  return input.saveVersion === 1;
}

function isSaveV2(input: SaveFile): input is SaveFileV2 {
  return input.saveVersion === 2;
}

function migrateV1ToV2(input: SaveFileV1): SaveFileV2 {
  return {
    saveVersion: 2,
    timestamp: input.timestamp,
    player: {
      ...input.player,
      stamina: 100,
      maxStamina: 100
    },
    inventory: input.inventory,
    quests: input.quests,
    worldFlags: input.worldFlags
  };
}

function migrateV2ToV3(input: SaveFileV2): SaveFileV3 {
  return {
    saveVersion: 3,
    timestamp: input.timestamp,
    session: {
      player: {
        level: input.player.level,
        xp: 0,
        xpToNext: 100,
        hp: input.player.hp,
        maxHp: input.player.maxHp,
        stamina: input.player.stamina,
        maxStamina: input.player.maxStamina,
        attack: 12,
        defense: 6,
        crit: 0.05,
        moveSpeed: 145
      },
      cinders: input.player.cinders,
      equipment: {
        weapon: 'weapon_warden_blade',
        offhand: null,
        armor: null,
        trinkets: [null, null],
        weaponMode: 'sword'
      },
      inventory: input.inventory,
      quests: input.quests,
      worldFlags: input.worldFlags,
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
      timestamp: input.timestamp
    }
  };
}

export function migrateSave(input: SaveFile): SaveFileV3 {
  let current: SaveFile = input;

  while (current.saveVersion < CURRENT_SAVE_VERSION) {
    if (isSaveV1(current)) {
      current = migrateV1ToV2(current);
      continue;
    }

    if (isSaveV2(current)) {
      current = migrateV2ToV3(current);
      continue;
    }

    throw new Error(`No migration path from saveVersion=${current.saveVersion}`);
  }

  if (current.saveVersion !== CURRENT_SAVE_VERSION) {
    throw new Error(`Unsupported future save version: ${current.saveVersion}`);
  }

  return current;
}
