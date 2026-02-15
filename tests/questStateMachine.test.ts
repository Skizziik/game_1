import { describe, expect, it } from 'vitest';
import { QuestStateMachine } from '../src/game/systems/quests/QuestStateMachine';

describe('QuestStateMachine', () => {
  it('unlocks quest from flags and completes objectives', () => {
    const quests = new QuestStateMachine();

    quests.registerQuest({
      id: 'main_find_anchordust',
      title: 'Dust for the Forge',
      objectives: [
        { id: 'collect_anchor_dust', description: 'Collect Anchor Dust', required: 1 },
        { id: 'talk_rook', description: 'Talk to Rook', required: 1 }
      ],
      prerequisites: {
        flags: [{ id: 'talked_to_archivist', equals: true }]
      }
    });

    quests.syncAvailability();
    expect(quests.getQuest('main_find_anchordust')?.status).toBe('locked');

    quests.setFlag('talked_to_archivist', true);
    quests.syncAvailability();
    quests.startQuest('main_find_anchordust');

    quests.advanceObjective('main_find_anchordust', 'collect_anchor_dust');
    expect(quests.getQuest('main_find_anchordust')?.status).toBe('active');

    quests.advanceObjective('main_find_anchordust', 'talk_rook');
    expect(quests.getQuest('main_find_anchordust')?.status).toBe('completed');
  });

  it('can fail a non-completed quest', () => {
    const quests = new QuestStateMachine();

    quests.registerQuest({
      id: 'side_quarry_supply',
      title: 'Quarry Supply',
      objectives: [{ id: 'deliver_ore', description: 'Deliver ore', required: 3 }]
    });

    quests.syncAvailability();
    quests.startQuest('side_quarry_supply');
    quests.failQuest('side_quarry_supply');

    expect(quests.getQuest('side_quarry_supply')?.status).toBe('failed');
  });
});
