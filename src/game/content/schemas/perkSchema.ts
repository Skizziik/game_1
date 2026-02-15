import { z } from 'zod';

export const perkSchema = z.object({
  id: z.string().min(1),
  branch: z.enum(['Warden', 'Echo', 'Foundry']),
  name: z.string().min(1),
  description: z.string().min(1),
  maxRank: z.number().int().positive(),
  effects: z.record(z.number())
});

export type PerkData = z.infer<typeof perkSchema>;
