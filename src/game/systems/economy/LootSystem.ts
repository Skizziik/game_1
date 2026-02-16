import type { LootTableData } from '../../content/schemas';

export interface LootDrop {
  itemId: string;
  amount: number;
}

export class LootSystem {
  private readonly tables = new Map<string, LootTableData>();

  public constructor(tables: LootTableData[]) {
    for (const table of tables) {
      this.tables.set(table.id, table);
    }
  }

  public roll(tableId: string, rng: () => number = Math.random): LootDrop[] {
    const table = this.tables.get(tableId);
    if (!table) {
      return [];
    }

    const drops: LootDrop[] = [];

    for (const entry of table.entries) {
      const roll = rng();
      if (roll > entry.chance) {
        continue;
      }

      const amount = this.rollAmount(entry.minAmount, entry.maxAmount, rng);
      drops.push({ itemId: entry.itemId, amount });
    }

    return drops;
  }

  private rollAmount(min: number, max: number, rng: () => number): number {
    if (min === max) {
      return min;
    }

    const span = max - min + 1;
    const rolled = Math.floor(rng() * span);
    return min + rolled;
  }
}
