export type InventoryTag = 'quest' | 'material' | 'consumable' | 'gear' | 'key';

export interface ItemStack {
  itemId: string;
  amount: number;
  maxStack: number;
  tags: InventoryTag[];
}

export type InventorySlot = ItemStack | null;

export interface SerializedInventory {
  width: number;
  height: number;
  slots: InventorySlot[];
  quickbar: Array<number | null>;
}
