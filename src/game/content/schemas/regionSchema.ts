import { z } from 'zod';

export const regionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  biome: z.enum(['hub', 'forest', 'quarry', 'marsh', 'dungeon']),
  recommendedLevel: z.number().int().positive(),
  neighbors: z.array(z.string().min(1)).default([]),
  signaturePuzzle: z.string().min(1)
});

export type RegionData = z.infer<typeof regionSchema>;
