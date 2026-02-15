import { describe, expect, it } from 'vitest';
import { CraftingSystem } from '../src/game/systems/crafting/CraftingSystem';
import { Inventory } from '../src/game/systems/inventory/Inventory';

describe('CraftingSystem', () => {
  it('crafts recipe when resources and cinders are sufficient', () => {
    const inventory = new Inventory(4, 2, 2);
    inventory.addItem({ itemId: 'material_iron_ore', amount: 5, maxStack: 99, tags: ['material'] });

    const crafting = new CraftingSystem([
      {
        id: 'craft_heal',
        name: 'Heal',
        station: 'foundry',
        output: {
          itemId: 'consumable_heal_small',
          amount: 2,
          maxStack: 20,
          tags: ['consumable']
        },
        cost: [{ itemId: 'material_iron_ore', amount: 3 }],
        cindersCost: 10
      }
    ]);

    const result = crafting.craft('craft_heal', inventory, 20);

    expect(result.crafted).toBe(true);
    expect(result.newCinders).toBe(10);
    expect(inventory.countItem('material_iron_ore')).toBe(2);
    expect(inventory.countItem('consumable_heal_small')).toBe(2);
  });

  it('fails craft when requirements are not met', () => {
    const inventory = new Inventory(4, 2, 2);

    const crafting = new CraftingSystem([
      {
        id: 'craft_heal',
        name: 'Heal',
        station: 'foundry',
        output: {
          itemId: 'consumable_heal_small',
          amount: 2,
          maxStack: 20,
          tags: ['consumable']
        },
        cost: [{ itemId: 'material_iron_ore', amount: 3 }],
        cindersCost: 10
      }
    ]);

    const result = crafting.craft('craft_heal', inventory, 5);

    expect(result.crafted).toBe(false);
    expect(result.newCinders).toBe(5);
  });
});
