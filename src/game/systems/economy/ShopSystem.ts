import type { InventoryTag } from '../inventory/types';
import type { GameSession } from '../../state/GameSession';
import type { ShopRuntimeState } from '../../state/types';

export interface ShopListing {
  id: string;
  itemId: string;
  displayName: string;
  buyPrice: number;
  baseStock: number;
  restockTo: number;
  maxStack?: number;
  tags?: InventoryTag[];
}

export interface ShopPurchaseResult {
  ok: boolean;
  reason?: string;
  listingId: string;
  itemId: string;
  spentCinders: number;
}

export interface ShopSellResult {
  ok: boolean;
  reason?: string;
  soldItemId: string;
  soldAmount: number;
  earnedCinders: number;
}

const RESTOCK_INTERVAL_SECONDS = 240;

export class ShopSystem {
  private readonly listings = new Map<string, ShopListing>();
  private readonly stockByListingId: Record<string, number> = {};
  private restockProgress = 0;

  public constructor(listings: ShopListing[], snapshot?: ShopRuntimeState) {
    for (const listing of listings) {
      this.listings.set(listing.id, listing);
    }

    for (const listing of listings) {
      const persisted = snapshot?.stockByListingId?.[listing.id];
      this.stockByListingId[listing.id] =
        typeof persisted === 'number' ? Math.max(0, Math.floor(persisted)) : listing.baseStock;
    }

    this.restockProgress = snapshot?.restockProgress ?? 0;
  }

  public tick(deltaSeconds: number): boolean {
    this.restockProgress += deltaSeconds;

    let restocked = false;
    while (this.restockProgress >= RESTOCK_INTERVAL_SECONDS) {
      this.restockProgress -= RESTOCK_INTERVAL_SECONDS;
      this.restock();
      restocked = true;
    }

    return restocked;
  }

  public listCatalog(): Array<ShopListing & { stock: number }> {
    return [...this.listings.values()].map((listing) => ({
      ...listing,
      stock: this.stockByListingId[listing.id] ?? 0
    }));
  }

  public buy(listingId: string, session: GameSession): ShopPurchaseResult {
    const listing = this.listings.get(listingId);
    if (!listing) {
      return { ok: false, reason: `Unknown listing ${listingId}`, listingId, itemId: '', spentCinders: 0 };
    }

    const stock = this.stockByListingId[listing.id] ?? 0;
    if (stock <= 0) {
      return {
        ok: false,
        reason: `${listing.displayName} is out of stock.`,
        listingId,
        itemId: listing.itemId,
        spentCinders: 0
      };
    }

    if (session.getCinders() < listing.buyPrice) {
      return {
        ok: false,
        reason: `Not enough cinders for ${listing.displayName}.`,
        listingId,
        itemId: listing.itemId,
        spentCinders: 0
      };
    }

    const overflow = session.addItem(listing.itemId, 1, listing.maxStack);
    if (overflow > 0) {
      return {
        ok: false,
        reason: 'Inventory full.',
        listingId,
        itemId: listing.itemId,
        spentCinders: 0
      };
    }

    const spent = session.spendCinders(listing.buyPrice);
    if (!spent) {
      session.removeItem(listing.itemId, 1);
      return {
        ok: false,
        reason: 'Unable to spend cinders.',
        listingId,
        itemId: listing.itemId,
        spentCinders: 0
      };
    }

    this.stockByListingId[listing.id] = stock - 1;

    return {
      ok: true,
      listingId,
      itemId: listing.itemId,
      spentCinders: listing.buyPrice
    };
  }

  public sell(itemId: string, amount: number, session: GameSession): ShopSellResult {
    if (amount <= 0) {
      return {
        ok: false,
        reason: 'Amount must be positive.',
        soldItemId: itemId,
        soldAmount: 0,
        earnedCinders: 0
      };
    }

    if (!session.canSellItem(itemId)) {
      return {
        ok: false,
        reason: `${itemId} cannot be sold.`,
        soldItemId: itemId,
        soldAmount: 0,
        earnedCinders: 0
      };
    }

    const removed = session.removeItem(itemId, amount);
    if (removed <= 0) {
      return {
        ok: false,
        reason: `${itemId} is not in inventory.`,
        soldItemId: itemId,
        soldAmount: 0,
        earnedCinders: 0
      };
    }

    const value = session.getItemValue(itemId);
    const earned = Math.max(1, Math.floor(value * 0.6) * removed);
    session.addCinders(earned);

    return {
      ok: true,
      soldItemId: itemId,
      soldAmount: removed,
      earnedCinders: earned
    };
  }

  public serialize(): ShopRuntimeState {
    return {
      stockByListingId: { ...this.stockByListingId },
      restockProgress: this.restockProgress
    };
  }

  public getSecondsToRestock(): number {
    return Math.max(0, Math.ceil(RESTOCK_INTERVAL_SECONDS - this.restockProgress));
  }

  private restock(): void {
    for (const listing of this.listings.values()) {
      const current = this.stockByListingId[listing.id] ?? 0;
      this.stockByListingId[listing.id] = Math.min(listing.restockTo, current + 1);
    }
  }
}
