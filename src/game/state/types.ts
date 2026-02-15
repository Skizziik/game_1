import type { InventoryTag, SerializedInventory } from '../systems/inventory/types';
import type { SerializedQuestState, QuestStatus } from '../systems/quests/QuestStateMachine';

export type WeaponMode = 'sword' | 'spear' | 'bow';

export interface PlayerStats {
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  attack: number;
  defense: number;
  crit: number;
  moveSpeed: number;
}

export interface EquipmentState {
  weapon: string | null;
  offhand: string | null;
  armor: string | null;
  trinkets: [string | null, string | null];
  weaponMode: WeaponMode;
}

export type FactionId = 'archivists' | 'pilgrims' | 'foundry';

export interface PerkDefinition {
  id: string;
  branch: 'Warden' | 'Echo' | 'Foundry';
  name: string;
  description: string;
  maxRank: number;
  effects: Record<string, number>;
}

export interface PerkState {
  points: number;
  ranks: Record<string, number>;
}

export interface RegionState {
  unlocked: string[];
  discovered: string[];
}

export interface EquipmentUpgradeState {
  weapon: number;
  armor: number;
}

export interface ShopRuntimeState {
  stockByListingId: Record<string, number>;
  restockProgress: number;
}

export interface RewardPackage {
  cinders?: number;
  xp?: number;
  reputation?: Partial<Record<FactionId, number>>;
  items?: Array<{ itemId: string; amount: number; maxStack?: number; tags?: InventoryTag[] }>;
}

export interface HudViewModel {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  level: number;
  xp: number;
  xpToNext: number;
  cinders: number;
  activeWeaponMode: WeaponMode;
  questHint: string;
  events: string[];
  quickbar: string[];
}

export interface QuestUiEntry {
  id: string;
  title: string;
  status: QuestStatus;
  objectives: Array<{
    id: string;
    description: string;
    progress: number;
    required: number;
  }>;
}

export interface InventoryUiEntry {
  index: number;
  itemId: string | null;
  amount: number;
  tags: InventoryTag[];
}

export interface SessionSnapshot {
  player: PlayerStats;
  cinders: number;
  equipment: EquipmentState;
  inventory: SerializedInventory;
  quests: SerializedQuestState;
  worldFlags: Record<string, string | number | boolean>;
  reputations: Record<FactionId, number>;
  perks: PerkState;
  regions: RegionState;
  upgrades?: EquipmentUpgradeState;
  shop?: ShopRuntimeState;
  eventLog: string[];
  timestamp: string;
}
