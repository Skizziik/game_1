import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/game/state/GameSession';
import { ShopSystem } from '../src/game/systems/economy/ShopSystem';

describe('ShopSystem', () => {
  it('supports buy and sell operations with stock tracking', () => {
    const session = new GameSession();

    const shop = new ShopSystem([
      {
        id: 'heal_tonic',
        itemId: 'consumable_heal_small',
        displayName: 'Cloudleaf Tincture',
        buyPrice: 15,
        baseStock: 2,
        restockTo: 3
      }
    ]);

    const cindersBefore = session.getCinders();
    const amountBefore = session.countItem('consumable_heal_small');

    const buy = shop.buy('heal_tonic', session);

    expect(buy.ok).toBe(true);
    expect(session.getCinders()).toBe(cindersBefore - 15);
    expect(session.countItem('consumable_heal_small')).toBe(amountBefore + 1);
    expect(shop.listCatalog()[0].stock).toBe(1);

    const sell = shop.sell('material_iron_ore', 2, session);
    expect(sell.ok).toBe(true);
    expect(sell.earnedCinders).toBeGreaterThan(0);

    const blocked = shop.sell('key_anchor_dust', 1, session);
    expect(blocked.ok).toBe(false);
  });

  it('restocks listings over time', () => {
    const session = new GameSession();

    const shop = new ShopSystem([
      {
        id: 'stamina_vial',
        itemId: 'consumable_stamina_vial',
        displayName: 'Quicksilver Draught',
        buyPrice: 25,
        baseStock: 1,
        restockTo: 2
      }
    ]);

    shop.buy('stamina_vial', session);
    expect(shop.listCatalog()[0].stock).toBe(0);

    const restocked = shop.tick(260);
    expect(restocked).toBe(true);
    expect(shop.listCatalog()[0].stock).toBe(1);
  });
});
