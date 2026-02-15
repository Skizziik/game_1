import { migrateSave } from './migrations';
import type { SaveFile, SaveFileV2 } from './SaveTypes';

const SLOT_COUNT = 3;
const SLOT_PREFIX = 'ash-aether-save-slot';

export class SaveRepository {
  public getMaxSlots(): number {
    return SLOT_COUNT;
  }

  public load(slot: number): SaveFileV2 | null {
    this.assertSlot(slot);

    const payload = localStorage.getItem(this.slotKey(slot));
    if (!payload) {
      return null;
    }

    const parsed = JSON.parse(payload) as SaveFile;
    return migrateSave(parsed);
  }

  public save(slot: number, data: SaveFile): void {
    this.assertSlot(slot);

    const payload: SaveFile = {
      ...data,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem(this.slotKey(slot), JSON.stringify(payload));
  }

  public clear(slot: number): void {
    this.assertSlot(slot);
    localStorage.removeItem(this.slotKey(slot));
  }

  public listSlots(): Array<{ slot: number; exists: boolean }> {
    return Array.from({ length: SLOT_COUNT }, (_, i) => ({
      slot: i,
      exists: Boolean(localStorage.getItem(this.slotKey(i)))
    }));
  }

  private slotKey(slot: number): string {
    return `${SLOT_PREFIX}-${slot}`;
  }

  private assertSlot(slot: number): void {
    if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) {
      throw new Error(`Save slot index is out of range: ${slot}`);
    }
  }
}
