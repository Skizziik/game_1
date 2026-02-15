import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/game/state/GameSession';

describe('GameSession quest flag syncing', () => {
  it('unlocks flag-gated quests when world flags change', () => {
    const session = new GameSession();

    expect(session.getQuestStatus('side_herbal_supplies')).toBe('locked');

    session.setFlag('talked_to_archivist', true);

    expect(session.getQuestStatus('side_herbal_supplies')).toBe('available');
  });

  it('restores quest flag gates from loaded snapshots', () => {
    const session = new GameSession();
    const snapshot = session.serialize();
    snapshot.worldFlags.talked_to_archivist = true;

    const loaded = new GameSession(snapshot);

    expect(loaded.getQuestStatus('side_herbal_supplies')).toBe('available');
  });

  it('unlocks Hollow Hart quest after Dust for the Forge', () => {
    const session = new GameSession();

    session.setFlag('talked_to_archivist', true);
    session.startQuest('main_find_anchordust');
    session.completeQuest('main_find_anchordust');

    expect(session.getQuestStatus('main_hollow_hart')).toBe('available');
  });
});
