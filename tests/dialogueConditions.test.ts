import { describe, expect, it } from 'vitest';
import { DialogueRuntime, type DialogueStateAccess } from '../src/game/systems/dialogue/DialogueRuntime';
import type { QuestStatus } from '../src/game/systems/quests/QuestStateMachine';

function createState(): DialogueStateAccess & {
  flags: Record<string, string | number | boolean>;
  inventory: Record<string, number>;
  reputation: Record<string, number>;
  quests: Record<string, QuestStatus>;
} {
  const flags: Record<string, string | number | boolean> = { talked_to_archivist: true };
  const inventory: Record<string, number> = { key_anchor_dust: 1 };
  const reputation: Record<string, number> = { archivists: 2 };
  const quests: Record<string, QuestStatus> = { main_find_anchordust: 'available' };

  return {
    flags,
    inventory,
    reputation,
    quests,
    getFlag: (id) => flags[id],
    setFlag: (id, value) => {
      flags[id] = value;
    },
    getStat: () => 10,
    getItemCount: (id) => inventory[id] ?? 0,
    addItem: (id, amount) => {
      inventory[id] = (inventory[id] ?? 0) + amount;
    },
    getReputation: (id) => reputation[id] ?? 0,
    addReputation: (id, amount) => {
      reputation[id] = (reputation[id] ?? 0) + amount;
    },
    getQuestStatus: (id) => quests[id],
    startQuest: (id) => {
      quests[id] = 'active';
    },
    completeQuest: (id) => {
      quests[id] = 'completed';
    }
  };
}

describe('DialogueRuntime', () => {
  it('filters choices by conditions and applies effects', () => {
    const state = createState();

    const runtime = new DialogueRuntime(
      {
        conversationId: 'archivist_intro',
        nodes: [
          {
            id: 'start',
            speakerId: 'npc_archivist_lyra',
            text: 'History hides.',
            choices: [
              {
                id: 'accept',
                text: 'I can help.',
                nextNodeId: 'end',
                conditions: [
                  { type: 'flagEquals', flagId: 'talked_to_archivist', equals: true },
                  { type: 'itemCountAtLeast', itemId: 'key_anchor_dust', value: 1 }
                ],
                effects: [
                  { type: 'addReputation', factionId: 'archivists', value: 3 },
                  { type: 'startQuest', questId: 'main_find_anchordust' }
                ]
              },
              {
                id: 'locked',
                text: 'No supplies yet.',
                nextNodeId: 'end',
                conditions: [{ type: 'itemCountAtLeast', itemId: 'key_anchor_dust', value: 2 }]
              }
            ]
          },
          {
            id: 'end',
            speakerId: 'npc_archivist_lyra',
            text: 'Good luck.',
            choices: []
          }
        ]
      },
      state
    );

    const choices = runtime.getAvailableChoices('start');
    expect(choices).toHaveLength(1);
    expect(choices[0].id).toBe('accept');

    const nextNode = runtime.applyChoice(choices[0]);

    expect(nextNode).toBe('end');
    expect(state.reputation.archivists).toBe(5);
    expect(state.quests.main_find_anchordust).toBe('active');
  });
});
