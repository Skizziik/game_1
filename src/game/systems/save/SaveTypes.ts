import type { SerializedInventory } from '../inventory/types';
import type { SerializedQuestState } from '../quests/QuestStateMachine';
import type { SessionSnapshot } from '../../state/types';

export const CURRENT_SAVE_VERSION = 3;

export interface SavePlayerV1 {
  level: number;
  hp: number;
  maxHp: number;
  cinders: number;
}

export interface SavePlayerV2 extends SavePlayerV1 {
  stamina: number;
  maxStamina: number;
}

export interface SaveFileV1 {
  saveVersion: 1;
  timestamp: string;
  player: SavePlayerV1;
  inventory: SerializedInventory;
  quests: SerializedQuestState;
  worldFlags: Record<string, string | number | boolean>;
}

export interface SaveFileV2 {
  saveVersion: 2;
  timestamp: string;
  player: SavePlayerV2;
  inventory: SerializedInventory;
  quests: SerializedQuestState;
  worldFlags: Record<string, string | number | boolean>;
}

export interface SaveFileV3 {
  saveVersion: 3;
  timestamp: string;
  session: SessionSnapshot;
}

export type SaveFile = SaveFileV1 | SaveFileV2 | SaveFileV3;
