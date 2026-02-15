import { z } from 'zod';

const conditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('flagEquals'), flagId: z.string().min(1), equals: z.union([z.string(), z.number(), z.boolean()]) }),
  z.object({ type: z.literal('statAtLeast'), statId: z.string().min(1), value: z.number() }),
  z.object({ type: z.literal('itemCountAtLeast'), itemId: z.string().min(1), value: z.number().int().min(0) }),
  z.object({ type: z.literal('reputationAtLeast'), factionId: z.string().min(1), value: z.number().int() }),
  z.object({ type: z.literal('questStatus'), questId: z.string().min(1), status: z.enum(['locked', 'available', 'active', 'completed', 'failed']) })
]);

const effectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setFlag'), flagId: z.string().min(1), value: z.union([z.string(), z.number(), z.boolean()]) }),
  z.object({ type: z.literal('addReputation'), factionId: z.string().min(1), value: z.number().int() }),
  z.object({ type: z.literal('addItem'), itemId: z.string().min(1), amount: z.number().int().positive() }),
  z.object({ type: z.literal('startQuest'), questId: z.string().min(1) }),
  z.object({ type: z.literal('completeQuest'), questId: z.string().min(1) })
]);

const choiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  nextNodeId: z.string().min(1),
  conditions: z.array(conditionSchema).default([]),
  effects: z.array(effectSchema).default([])
});

const nodeSchema = z.object({
  id: z.string().min(1),
  speakerId: z.string().min(1),
  portrait: z.string().optional(),
  text: z.string().min(1),
  tags: z.array(z.string()).default([]),
  conditions: z.array(conditionSchema).default([]),
  effects: z.array(effectSchema).default([]),
  choices: z.array(choiceSchema).default([])
});

export const dialogueSchema = z.object({
  conversationId: z.string().min(1),
  nodes: z.array(nodeSchema).min(1)
});

export type DialogueData = z.infer<typeof dialogueSchema>;
