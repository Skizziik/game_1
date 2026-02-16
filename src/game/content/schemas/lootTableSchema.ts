import { z } from 'zod';

const lootEntrySchema = z
  .object({
    itemId: z.string().min(1),
    chance: z.number().min(0).max(1),
    minAmount: z.number().int().min(1),
    maxAmount: z.number().int().min(1)
  })
  .refine((entry) => entry.maxAmount >= entry.minAmount, {
    message: 'maxAmount must be greater than or equal to minAmount',
    path: ['maxAmount']
  });

export const lootTableSchema = z.object({
  id: z.string().min(1),
  entries: z.array(lootEntrySchema).min(1)
});

export type LootTableData = z.infer<typeof lootTableSchema>;
