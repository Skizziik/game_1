import { z } from 'zod';

export const recipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  station: z.enum(['foundry', 'camp']),
  output: z.object({
    itemId: z.string().min(1),
    amount: z.number().int().positive(),
    maxStack: z.number().int().positive(),
    tags: z.array(z.enum(['quest', 'material', 'consumable', 'gear', 'key']))
  }),
  cost: z.array(
    z.object({
      itemId: z.string().min(1),
      amount: z.number().int().positive()
    })
  ),
  cindersCost: z.number().int().min(0)
});

export type RecipeData = z.infer<typeof recipeSchema>;
