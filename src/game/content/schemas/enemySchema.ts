import { z } from 'zod';

export const enemySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hp: z.number().int().positive(),
  attack: z.number().int().min(0),
  defense: z.number().int().min(0),
  speed: z.number().positive(),
  lootTableId: z.string().min(1),
  aiProfileId: z.string().min(1),
  animations: z.object({
    idle: z.string().min(1),
    walk: z.string().min(1),
    attack: z.string().min(1),
    hurt: z.string().min(1),
    death: z.string().min(1)
  }),
  hitbox: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    offsetX: z.number(),
    offsetY: z.number()
  })
});

export type EnemyData = z.infer<typeof enemySchema>;
