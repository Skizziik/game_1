import type { PerkDefinition, PerkState } from '../../state/types';

export class PerkTree {
  private readonly definitions = new Map<string, PerkDefinition>();
  private readonly ranks: Record<string, number> = {};
  private points = 0;

  public constructor(definitions: PerkDefinition[], state?: PerkState) {
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition);
    }

    if (state) {
      this.points = state.points;
      Object.assign(this.ranks, state.ranks);
    }
  }

  public setPoints(points: number): void {
    this.points = Math.max(0, Math.floor(points));
  }

  public addPoints(points: number): void {
    this.points += Math.max(0, Math.floor(points));
  }

  public getPoints(): number {
    return this.points;
  }

  public getRank(perkId: string): number {
    return this.ranks[perkId] ?? 0;
  }

  public getDefinition(perkId: string): PerkDefinition | undefined {
    return this.definitions.get(perkId);
  }

  public getAllDefinitions(): PerkDefinition[] {
    return [...this.definitions.values()];
  }

  public getAllEffects(): Record<string, number> {
    const effects: Record<string, number> = {};

    for (const definition of this.definitions.values()) {
      const rank = this.getRank(definition.id);
      if (rank <= 0) {
        continue;
      }

      for (const [effectId, amountPerRank] of Object.entries(definition.effects)) {
        effects[effectId] = (effects[effectId] ?? 0) + amountPerRank * rank;
      }
    }

    return effects;
  }

  public unlock(perkId: string): void {
    const definition = this.definitions.get(perkId);
    if (!definition) {
      throw new Error(`Perk ${perkId} is not defined`);
    }

    if (this.points <= 0) {
      throw new Error('Not enough perk points');
    }

    const rank = this.getRank(perkId);
    if (rank >= definition.maxRank) {
      throw new Error(`Perk ${perkId} is already max rank`);
    }

    this.ranks[perkId] = rank + 1;
    this.points -= 1;
  }

  public serialize(): PerkState {
    return {
      points: this.points,
      ranks: { ...this.ranks }
    };
  }
}
