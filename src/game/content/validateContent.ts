import { ZodError } from 'zod';
import {
  dialogueSchema,
  enemySchema,
  itemSchema,
  perkSchema,
  questSchema,
  recipeSchema,
  regionSchema,
  type DialogueData,
  type EnemyData,
  type ItemData,
  type PerkData,
  type QuestData,
  type RecipeData,
  type RegionData
} from './schemas';

export interface ContentBundle {
  items: unknown[];
  enemies: unknown[];
  quests: unknown[];
  dialogues: unknown[];
  perks: unknown[];
  recipes: unknown[];
  regions: unknown[];
}

export interface ContentValidationResult {
  ok: boolean;
  errors: string[];
  parsed?: {
    items: ItemData[];
    enemies: EnemyData[];
    quests: QuestData[];
    dialogues: DialogueData[];
    perks: PerkData[];
    recipes: RecipeData[];
    regions: RegionData[];
  };
}

export function validateContent(bundle: ContentBundle): ContentValidationResult {
  const errors: string[] = [];

  const itemResult = parseCollection('items', bundle.items, itemSchema, errors);
  const enemyResult = parseCollection('enemies', bundle.enemies, enemySchema, errors);
  const questResult = parseCollection('quests', bundle.quests, questSchema, errors);
  const dialogueResult = parseCollection('dialogues', bundle.dialogues, dialogueSchema, errors);
  const perkResult = parseCollection('perks', bundle.perks, perkSchema, errors);
  const recipeResult = parseCollection('recipes', bundle.recipes, recipeSchema, errors);
  const regionResult = parseCollection('regions', bundle.regions, regionSchema, errors);

  if (!itemResult || !enemyResult || !questResult || !dialogueResult || !perkResult || !recipeResult || !regionResult) {
    return { ok: false, errors };
  }

  const itemIds = new Set(itemResult.map((item) => item.id));
  checkDuplicateIds(itemResult.map((item) => item.id), 'items', errors);
  checkDuplicateIds(enemyResult.map((enemy) => enemy.id), 'enemies', errors);
  checkDuplicateIds(questResult.map((quest) => quest.id), 'quests', errors);
  checkDuplicateIds(dialogueResult.map((dialogue) => dialogue.conversationId), 'dialogues', errors);
  checkDuplicateIds(perkResult.map((perk) => perk.id), 'perks', errors);
  checkDuplicateIds(recipeResult.map((recipe) => recipe.id), 'recipes', errors);
  checkDuplicateIds(regionResult.map((region) => region.id), 'regions', errors);

  for (const quest of questResult) {
    for (const rewardItem of quest.rewards.items) {
      if (!itemIds.has(rewardItem.itemId)) {
        errors.push(`Quest ${quest.id} references unknown reward item ${rewardItem.itemId}`);
      }
    }
  }

  for (const conversation of dialogueResult) {
    validateDialogueGraph(conversation, errors);

    for (const node of conversation.nodes) {
      for (const effect of node.effects) {
        if (effect.type === 'addItem' && !itemIds.has(effect.itemId)) {
          errors.push(`Dialogue ${conversation.conversationId}/${node.id} references unknown item ${effect.itemId}`);
        }
      }

      for (const choice of node.choices) {
        for (const effect of choice.effects) {
          if (effect.type === 'addItem' && !itemIds.has(effect.itemId)) {
            errors.push(
              `Dialogue ${conversation.conversationId}/${node.id}/${choice.id} references unknown item ${effect.itemId}`
            );
          }
        }
      }
    }
  }

  for (const recipe of recipeResult) {
    if (!itemIds.has(recipe.output.itemId)) {
      errors.push(`Recipe ${recipe.id} output item does not exist: ${recipe.output.itemId}`);
    }

    for (const cost of recipe.cost) {
      if (!itemIds.has(cost.itemId)) {
        errors.push(`Recipe ${recipe.id} references unknown cost item ${cost.itemId}`);
      }
    }
  }

  const regionIds = new Set(regionResult.map((region) => region.id));
  for (const region of regionResult) {
    for (const neighbor of region.neighbors) {
      if (!regionIds.has(neighbor)) {
        errors.push(`Region ${region.id} references unknown neighbor ${neighbor}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    parsed: {
      items: itemResult,
      enemies: enemyResult,
      quests: questResult,
      dialogues: dialogueResult,
      perks: perkResult,
      recipes: recipeResult,
      regions: regionResult
    }
  };
}

function parseCollection<T>(
  label: string,
  rows: unknown[],
  schema: { parse: (input: unknown) => T },
  errors: string[]
): T[] | null {
  const parsed: T[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    try {
      parsed.push(schema.parse(rows[i]));
    } catch (error) {
      if (error instanceof ZodError) {
        const formatted = error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('; ');
        errors.push(`${label}[${i}] ${formatted}`);
      } else {
        errors.push(`${label}[${i}] ${String(error)}`);
      }
    }
  }

  if (errors.some((entry) => entry.startsWith(`${label}[`))) {
    return null;
  }

  return parsed;
}

function checkDuplicateIds(ids: string[], label: string, errors: string[]): void {
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(`Duplicate id in ${label}: ${id}`);
      continue;
    }
    seen.add(id);
  }
}

function validateDialogueGraph(dialogue: DialogueData, errors: string[]): void {
  const nodeIds = new Set(dialogue.nodes.map((node) => node.id));
  const adjacency = new Map<string, string[]>();

  for (const node of dialogue.nodes) {
    const edges: string[] = [];
    for (const choice of node.choices) {
      if (!nodeIds.has(choice.nextNodeId)) {
        errors.push(
          `Dialogue ${dialogue.conversationId} node ${node.id} points to missing node ${choice.nextNodeId}`
        );
      }
      edges.push(choice.nextNodeId);
    }
    adjacency.set(node.id, edges);
  }

  const visited = new Set<string>();
  const stack = new Set<string>();

  const hasCycle = (nodeId: string): boolean => {
    if (stack.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    stack.add(nodeId);

    for (const target of adjacency.get(nodeId) ?? []) {
      if (hasCycle(target)) {
        return true;
      }
    }

    stack.delete(nodeId);
    return false;
  };

  for (const nodeId of nodeIds) {
    if (hasCycle(nodeId)) {
      errors.push(`Dialogue ${dialogue.conversationId} contains a cycle at node ${nodeId}`);
      break;
    }
  }
}
