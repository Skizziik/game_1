import type { InventorySlot, ItemStack, SerializedInventory } from './types';

export interface AddItemInput {
  itemId: string;
  amount: number;
  maxStack: number;
  tags?: ItemStack['tags'];
}

export class Inventory {
  private readonly width: number;
  private readonly height: number;
  private readonly slots: InventorySlot[];
  private readonly quickbar: Array<number | null>;

  public constructor(width = 6, height = 8, quickbarSize = 8) {
    this.width = width;
    this.height = height;
    this.slots = Array.from({ length: width * height }, () => null);
    this.quickbar = Array.from({ length: quickbarSize }, () => null);
  }

  public static fromSerialized(input: SerializedInventory): Inventory {
    const inventory = new Inventory(input.width, input.height, input.quickbar.length);

    for (let i = 0; i < inventory.slots.length; i += 1) {
      inventory.slots[i] = input.slots[i] ?? null;
    }

    for (let i = 0; i < inventory.quickbar.length; i += 1) {
      const slotIndex = input.quickbar[i];
      inventory.quickbar[i] = typeof slotIndex === 'number' ? slotIndex : null;
    }

    return inventory;
  }

  public get capacity(): number {
    return this.width * this.height;
  }

  public addItem(input: AddItemInput): number {
    let remaining = input.amount;
    const tags = input.tags ?? [];

    for (const slot of this.slots) {
      if (!slot) {
        continue;
      }
      if (slot.itemId !== input.itemId || slot.amount >= slot.maxStack) {
        continue;
      }

      const room = slot.maxStack - slot.amount;
      const toMove = Math.min(room, remaining);
      slot.amount += toMove;
      remaining -= toMove;

      if (remaining <= 0) {
        return 0;
      }
    }

    for (let i = 0; i < this.slots.length; i += 1) {
      if (this.slots[i]) {
        continue;
      }

      const toStore = Math.min(input.maxStack, remaining);
      this.slots[i] = {
        itemId: input.itemId,
        amount: toStore,
        maxStack: input.maxStack,
        tags
      };
      remaining -= toStore;

      if (remaining <= 0) {
        return 0;
      }
    }

    return remaining;
  }

  public removeItem(itemId: string, amount: number): number {
    let remaining = amount;

    for (let i = 0; i < this.slots.length; i += 1) {
      const slot = this.slots[i];
      if (!slot || slot.itemId !== itemId) {
        continue;
      }

      const toRemove = Math.min(slot.amount, remaining);
      slot.amount -= toRemove;
      remaining -= toRemove;

      if (slot.amount <= 0) {
        this.slots[i] = null;
      }

      if (remaining <= 0) {
        break;
      }
    }

    return amount - remaining;
  }

  public countItem(itemId: string): number {
    return this.slots.reduce((acc, slot) => (slot?.itemId === itemId ? acc + slot.amount : acc), 0);
  }

  public getSlots(): ReadonlyArray<InventorySlot> {
    return this.slots;
  }

  public assignQuickbar(quickbarIndex: number, slotIndex: number | null): void {
    if (quickbarIndex < 0 || quickbarIndex >= this.quickbar.length) {
      throw new Error(`Quickbar index ${quickbarIndex} is out of range`);
    }

    if (slotIndex !== null && (slotIndex < 0 || slotIndex >= this.slots.length)) {
      throw new Error(`Slot index ${slotIndex} is out of range`);
    }

    this.quickbar[quickbarIndex] = slotIndex;
  }

  public getQuickbar(): ReadonlyArray<number | null> {
    return this.quickbar;
  }

  public serialize(): SerializedInventory {
    return {
      width: this.width,
      height: this.height,
      slots: this.slots.map((slot) => (slot ? { ...slot, tags: [...slot.tags] } : null)),
      quickbar: [...this.quickbar]
    };
  }
}
