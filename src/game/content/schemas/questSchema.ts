import { z } from 'zod';

const objectiveSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['kill', 'collect', 'talk', 'enter_zone', 'solve_puzzle']),
  targetId: z.string().min(1),
  required: z.number().int().positive()
});

export const questSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(['main', 'side', 'faction', 'bounty', 'exploration']),
  prerequisites: z
    .object({
      flags: z.array(z.object({ id: z.string().min(1), equals: z.boolean() })).default([]),
      quests: z.array(z.string().min(1)).default([])
    })
    .optional(),
  objectives: z.array(objectiveSchema).min(1),
  rewards: z.object({
    items: z.array(z.object({ itemId: z.string().min(1), amount: z.number().int().positive() })).default([]),
    cinders: z.number().int().min(0),
    xp: z.number().int().min(0),
    reputation: z.array(z.object({ factionId: z.string().min(1), amount: z.number().int() })).default([])
  }),
  onComplete: z
    .object({
      setFlags: z.array(z.object({ id: z.string().min(1), value: z.boolean() })).default([]),
      unlockRegions: z.array(z.string().min(1)).default([])
    })
    .optional()
});

export type QuestData = z.infer<typeof questSchema>;
