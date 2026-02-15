import type { EquipmentUpgradeState } from '../../state/types';
import type { GameSession } from '../../state/GameSession';

export type UpgradeTarget = 'weapon' | 'armor';

export interface UpgradeAttempt {
  ok: boolean;
  target: UpgradeTarget;
  nextLevel: number;
  spentCinders: number;
  spentAnchorDust: number;
  reason?: string;
}

const MAX_UPGRADE_LEVEL = 5;

export class UpgradeSystem {
  public getUpgradeLevel(target: UpgradeTarget, state: EquipmentUpgradeState): number {
    return state[target] ?? 0;
  }

  public getUpgradeCost(target: UpgradeTarget, nextLevel: number): { cinders: number; anchorDust: number } {
    const cindersBase = target === 'weapon' ? 48 : 40;
    const cinders = cindersBase + nextLevel * nextLevel * 18;
    const anchorDust = Math.max(1, nextLevel);

    return { cinders, anchorDust };
  }

  public getAttackBonus(level: number): number {
    return level * 3;
  }

  public getDefenseBonus(level: number): number {
    return level * 2;
  }

  public tryUpgrade(target: UpgradeTarget, session: GameSession): UpgradeAttempt {
    const state = session.getEquipmentUpgrades();
    const current = this.getUpgradeLevel(target, state);

    if (current >= MAX_UPGRADE_LEVEL) {
      return {
        ok: false,
        target,
        nextLevel: current,
        spentCinders: 0,
        spentAnchorDust: 0,
        reason: `${target} is already +${MAX_UPGRADE_LEVEL}.`
      };
    }

    const nextLevel = current + 1;
    const cost = this.getUpgradeCost(target, nextLevel);

    if (session.getCinders() < cost.cinders) {
      return {
        ok: false,
        target,
        nextLevel,
        spentCinders: 0,
        spentAnchorDust: 0,
        reason: 'Not enough cinders.'
      };
    }

    if (session.countItem('key_anchor_dust') < cost.anchorDust) {
      return {
        ok: false,
        target,
        nextLevel,
        spentCinders: 0,
        spentAnchorDust: 0,
        reason: 'Not enough Anchor Dust.'
      };
    }

    session.spendCinders(cost.cinders);
    session.removeItem('key_anchor_dust', cost.anchorDust);
    session.setEquipmentUpgradeLevel(target, nextLevel);

    return {
      ok: true,
      target,
      nextLevel,
      spentCinders: cost.cinders,
      spentAnchorDust: cost.anchorDust
    };
  }
}
