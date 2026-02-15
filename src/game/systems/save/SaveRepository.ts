import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './SaveTypes';
import type { SaveFile, SaveFileV3 } from './SaveTypes';
import type { SessionSnapshot } from '../../state/types';

const SLOT_COUNT = 3;
const SLOT_PREFIX = 'ash-aether-save-slot';

export class SaveRepository {
  public getMaxSlots(): number {
    return SLOT_COUNT;
  }

  public load(slot: number): SaveFileV3 | null {
    this.assertSlot(slot);

    const payload = localStorage.getItem(this.slotKey(slot));
    if (!payload) {
      return null;
    }

    const parsed = JSON.parse(payload) as SaveFile;
    return migrateSave(parsed);
  }

  public save(slot: number, snapshot: SessionSnapshot): void {
    this.assertSlot(slot);

    const payload: SaveFileV3 = {
      saveVersion: CURRENT_SAVE_VERSION,
      timestamp: new Date().toISOString(),
      session: {
        ...snapshot,
        timestamp: new Date().toISOString()
      }
    };

    localStorage.setItem(this.slotKey(slot), JSON.stringify(payload));
  }

  public clear(slot: number): void {
    this.assertSlot(slot);
    localStorage.removeItem(this.slotKey(slot));
  }

  public listSlots(): Array<{ slot: number; exists: boolean; timestamp: string | null }> {
    return Array.from({ length: SLOT_COUNT }, (_, i) => {
      const payload = localStorage.getItem(this.slotKey(i));
      if (!payload) {
        return { slot: i, exists: false, timestamp: null };
      }

      try {
        const parsed = migrateSave(JSON.parse(payload) as SaveFile);
        return { slot: i, exists: true, timestamp: parsed.timestamp };
      } catch {
        return { slot: i, exists: true, timestamp: 'corrupted' };
      }
    });
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
