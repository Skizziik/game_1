import { CURRENT_SAVE_VERSION } from './SaveTypes';
import type { SaveFile, SaveFileV1, SaveFileV2 } from './SaveTypes';

function isSaveV1(input: SaveFile): input is SaveFileV1 {
  return input.saveVersion === 1;
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

export function migrateSave(input: SaveFile): SaveFileV2 {
  let current: SaveFile = input;

  while (current.saveVersion < CURRENT_SAVE_VERSION) {
    if (isSaveV1(current)) {
      current = migrateV1ToV2(current);
      continue;
    }

    throw new Error(`No migration path from saveVersion=${current.saveVersion}`);
  }

  if (current.saveVersion !== CURRENT_SAVE_VERSION) {
    throw new Error(`Unsupported future save version: ${current.saveVersion}`);
  }

  return current;
}
