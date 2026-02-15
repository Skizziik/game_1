import { describe, expect, it } from 'vitest';
import { Inventory } from '../src/game/systems/inventory/Inventory';

describe('Inventory', () => {
  it('stacks items before using new slots', () => {
    const inventory = new Inventory(2, 1, 2);

    const firstOverflow = inventory.addItem({
      itemId: 'material_iron_ore',
      amount: 7,
      maxStack: 5,
      tags: ['material']
    });

    expect(firstOverflow).toBe(0);
    expect(inventory.getSlots()[0]?.amount).toBe(5);
    expect(inventory.getSlots()[1]?.amount).toBe(2);

    const secondOverflow = inventory.addItem({
      itemId: 'material_iron_ore',
      amount: 5,
      maxStack: 5,
      tags: ['material']
    });

    expect(secondOverflow).toBe(2);
    expect(inventory.getSlots()[0]?.amount).toBe(5);
    expect(inventory.getSlots()[1]?.amount).toBe(5);
  });

  it('removes item counts across slots', () => {
    const inventory = new Inventory(3, 1, 2);

    inventory.addItem({ itemId: 'consumable_heal_small', amount: 8, maxStack: 5, tags: ['consumable'] });

    const removed = inventory.removeItem('consumable_heal_small', 6);

    expect(removed).toBe(6);
    expect(inventory.countItem('consumable_heal_small')).toBe(2);
    expect(inventory.getSlots()[0]).toBeNull();
    expect(inventory.getSlots()[1]?.amount).toBe(2);
  });
});
