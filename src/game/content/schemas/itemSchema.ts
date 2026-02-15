import { z } from 'zod';

export const itemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().min(1),
  type: z.enum(['consumable', 'material', 'weapon', 'armor', 'quest', 'key']),
  rarity: z.enum(['Common', 'Uncommon', 'Rare', 'Relic']),
  stackSize: z.number().int().min(1).max(999),
  value: z.number().int().min(0),
  statsModifiers: z
    .object({
      attack: z.number().int().optional(),
      defense: z.number().int().optional(),
      crit: z.number().min(0).optional(),
      moveSpeed: z.number().min(0).optional()
    })
    .optional(),
  tags: z.array(z.string()).default([]),
  useEffect: z
    .object({
      heal: z.number().int().min(0).optional(),
      stamina: z.number().int().min(0).optional(),
      buffId: z.string().optional(),
      durationSeconds: z.number().positive().optional()
    })
    .optional()
});

export type ItemData = z.infer<typeof itemSchema>;
