import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/game/state/GameSession';

describe('Objective progress hooks', () => {
  it('advances collect and talk objectives from runtime events', () => {
    const session = new GameSession();

    session.setFlag('talked_to_archivist', true);
    session.startQuest('main_find_anchordust');

    session.addItem('key_anchor_dust', 1);

    const afterCollect = session.getQuestEntries().find((entry) => entry.id === 'main_find_anchordust');
    const collectObjective = afterCollect?.objectives.find((entry) => entry.id === 'loot_cache');

    expect(collectObjective?.progress).toBe(1);
    expect(afterCollect?.status).toBe('active');

    session.recordObjectiveProgress('talk', 'npc_rook', 1);

    expect(session.getQuestStatus('main_find_anchordust')).toBe('completed');
  });

  it('advances kill objective for Hollow Hart through generic kill event', () => {
    const session = new GameSession();

    session.setFlag('talked_to_archivist', true);
    session.startQuest('main_find_anchordust');
    session.completeQuest('main_find_anchordust');
    session.startQuest('main_hollow_hart');

    session.recordObjectiveProgress('enter_zone', 'gloamwood', 1);
    session.recordObjectiveProgress('kill', 'hollow_hart', 1);

    expect(session.getQuestStatus('main_hollow_hart')).toBe('completed');
  });
});
