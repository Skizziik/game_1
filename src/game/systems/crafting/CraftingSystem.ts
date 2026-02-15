import type { Inventory } from '../inventory/Inventory';

export interface CraftRecipe {
  id: string;
  name: string;
  station: 'foundry' | 'camp';
  output: {
    itemId: string;
    amount: number;
    maxStack: number;
    tags: Array<'quest' | 'material' | 'consumable' | 'gear' | 'key'>;
  };
  cost: Array<{
    itemId: string;
    amount: number;
  }>;
  cindersCost: number;
}

export class CraftingSystem {
  private readonly recipes = new Map<string, CraftRecipe>();

  public constructor(recipes: CraftRecipe[]) {
    for (const recipe of recipes) {
      this.recipes.set(recipe.id, recipe);
    }
  }

  public listRecipes(station: CraftRecipe['station']): CraftRecipe[] {
    return [...this.recipes.values()].filter((recipe) => recipe.station === station);
  }

  public canCraft(recipeId: string, inventory: Inventory, currentCinders: number): boolean {
    const recipe = this.requireRecipe(recipeId);

    if (currentCinders < recipe.cindersCost) {
      return false;
    }

    return recipe.cost.every((entry) => inventory.countItem(entry.itemId) >= entry.amount);
  }

  public craft(recipeId: string, inventory: Inventory, currentCinders: number): { newCinders: number; crafted: boolean } {
    const recipe = this.requireRecipe(recipeId);

    if (!this.canCraft(recipeId, inventory, currentCinders)) {
      return { newCinders: currentCinders, crafted: false };
    }

    for (const cost of recipe.cost) {
      inventory.removeItem(cost.itemId, cost.amount);
    }

    const overflow = inventory.addItem({
      itemId: recipe.output.itemId,
      amount: recipe.output.amount,
      maxStack: recipe.output.maxStack,
      tags: recipe.output.tags
    });

    if (overflow > 0) {
      for (const cost of recipe.cost) {
        inventory.addItem({
          itemId: cost.itemId,
          amount: cost.amount,
          maxStack: 99,
          tags: ['material']
        });
      }
      return { newCinders: currentCinders, crafted: false };
    }

    return { newCinders: currentCinders - recipe.cindersCost, crafted: true };
  }

  private requireRecipe(recipeId: string): CraftRecipe {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      throw new Error(`Unknown recipe ${recipeId}`);
    }
    return recipe;
  }
}
