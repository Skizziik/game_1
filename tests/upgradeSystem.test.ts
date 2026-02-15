import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/game/state/GameSession';
import { UpgradeSystem } from '../src/game/systems/upgrades/UpgradeSystem';

describe('UpgradeSystem', () => {
  it('upgrades weapon and increases attack power', () => {
    const session = new GameSession();
    const upgrades = new UpgradeSystem();

    session.addItem('key_anchor_dust', 20);
    session.addCinders(500);

    const before = session.getAttackPower(0);
    const result = upgrades.tryUpgrade('weapon', session);

    expect(result.ok).toBe(true);
    expect(session.getEquipmentUpgrades().weapon).toBe(1);
    expect(session.getAttackPower(0)).toBeGreaterThan(before);
  });

  it('blocks upgrade without materials', () => {
    const session = new GameSession();
    const upgrades = new UpgradeSystem();

    session.removeItem('key_anchor_dust', 99);

    const result = upgrades.tryUpgrade('armor', session);

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Anchor Dust');
  });
});
