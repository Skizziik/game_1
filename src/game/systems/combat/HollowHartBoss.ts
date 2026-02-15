import Phaser from 'phaser';
import type { GameSession } from '../../state/GameSession';

export type HollowHartPhase = 1 | 2 | 3;

type BossState = 'dormant' | 'active' | 'telegraph' | 'summoning' | 'dead';

export interface HollowHartContext {
  delta: number;
  player: Phaser.Physics.Arcade.Sprite;
  canDamagePlayer: boolean;
  onDealDamage: (damage: number) => void;
  onPhaseChange: (phase: HollowHartPhase) => void;
  onSummonAdds: (count: number) => void;
  onSummonRoots: () => void;
  onDefeated: () => void;
}

export interface HollowHartDamageResult {
  damage: number;
  killed: boolean;
  blockedByRoots: boolean;
}

export class HollowHartBoss {
  public readonly sprite: Phaser.Physics.Arcade.Sprite;

  private readonly maxHp = 920;
  private readonly spawnX: number;
  private readonly spawnY: number;
  private hp = this.maxHp;
  private phase: HollowHartPhase = 1;
  private state: BossState = 'dormant';

  private telegraphTimer = 0;
  private attackCooldown = 0;
  private summonTimer = 0;
  private onDefeatedFired = false;

  public constructor(private readonly scene: Phaser.Scene, x: number, y: number) {
    this.spawnX = x;
    this.spawnY = y;
    this.sprite = this.scene.physics.add.sprite(x, y, 'boss-hollow-hart');
    this.sprite.setDepth(6);
    this.sprite.setScale(2.4);
    this.sprite.setSize(22, 22);
    this.sprite.setOffset(5, 5);
    this.sprite.setImmovable(false);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setTint(0x5a7b5f);
    this.sprite.setVisible(false);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
  }

  public startEncounter(): void {
    if (this.state !== 'dormant') {
      return;
    }

    this.state = 'active';
    this.sprite.setVisible(true);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    this.attackCooldown = 1.1;
  }

  public resetEncounter(): void {
    this.hp = this.maxHp;
    this.phase = 1;
    this.state = 'dormant';
    this.telegraphTimer = 0;
    this.attackCooldown = 0;
    this.summonTimer = 0;
    this.onDefeatedFired = false;
    this.sprite.setVelocity(0, 0);
    this.sprite.clearTint();
    this.sprite.setPosition(this.spawnX, this.spawnY);
    this.sprite.setVisible(false);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
  }

  public isEncounterStarted(): boolean {
    return this.state !== 'dormant';
  }

  public isDead(): boolean {
    return this.state === 'dead';
  }

  public getPhase(): HollowHartPhase {
    return this.phase;
  }

  public getHpRatio(): number {
    return this.hp / this.maxHp;
  }

  public getHp(): number {
    return this.hp;
  }

  public getMaxHp(): number {
    return this.maxHp;
  }

  public update(context: HollowHartContext): void {
    if (this.markDefeatedEventHandled()) {
      context.onDefeated();
    }

    if (this.state === 'dormant' || this.state === 'dead') {
      this.sprite.setVelocity(0, 0);
      return;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - context.delta);
    this.telegraphTimer = Math.max(0, this.telegraphTimer - context.delta);

    this.updatePhases(context);

    const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, context.player.x, context.player.y);

    if (this.state === 'summoning') {
      this.sprite.setVelocity(0, 0);
      this.summonTimer = Math.max(0, this.summonTimer - context.delta);

      if (this.summonTimer <= 0) {
        context.onSummonAdds(3);
        context.onSummonRoots();
        this.state = 'active';
        this.attackCooldown = 1.8;
        this.sprite.clearTint();
      }
      return;
    }

    if (this.state === 'telegraph') {
      this.sprite.setVelocity(0, 0);
      if (this.telegraphTimer <= 0) {
        if (distance <= this.getAttackRange() + 16 && context.canDamagePlayer) {
          context.onDealDamage(this.getAttackDamage());
        }

        this.state = 'active';
        this.attackCooldown = this.getAttackCooldown();
        this.sprite.clearTint();
      }
      return;
    }

    this.moveTowardPlayer(context.player);

    if (distance <= this.getAttackRange() && this.attackCooldown <= 0) {
      this.state = 'telegraph';
      this.telegraphTimer = this.getTelegraphDuration();
      this.sprite.setTint(0xd88f57);
    }
  }

  public receiveDamage(baseDamage: number, session: GameSession, rootsActive: boolean): HollowHartDamageResult {
    if (this.state === 'dormant' || this.state === 'dead') {
      return { damage: 0, killed: false, blockedByRoots: false };
    }

    if (rootsActive) {
      return { damage: 0, killed: false, blockedByRoots: true };
    }

    const crit = Math.random() < session.getCritChance();
    const rolled = crit ? Math.floor(baseDamage * 1.45) : baseDamage;
    const reduced = Math.max(1, rolled - this.getDefense());

    this.hp = Math.max(0, this.hp - reduced);
    this.sprite.setTint(crit ? 0xf0b468 : 0xbf6a57);
    this.scene.time.delayedCall(110, () => {
      if (!this.isDead() && this.state !== 'telegraph') {
        this.sprite.clearTint();
      }
    });

    if (this.hp <= 0) {
      this.state = 'dead';
      this.sprite.setVelocity(0, 0);
      this.sprite.setTint(0x1e1d1c);
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.enable = false;

      if (!this.onDefeatedFired) {
        this.onDefeatedFired = true;
      }

      return { damage: reduced, killed: true, blockedByRoots: false };
    }

    return { damage: reduced, killed: false, blockedByRoots: false };
  }

  public markDefeatedEventHandled(): boolean {
    if (!this.onDefeatedFired) {
      return false;
    }

    this.onDefeatedFired = false;
    return true;
  }

  private updatePhases(context: HollowHartContext): void {
    const ratio = this.getHpRatio();

    if (this.phase === 1 && ratio <= 0.66) {
      this.phase = 2;
      context.onPhaseChange(2);
      this.state = 'summoning';
      this.summonTimer = 1.25;
      this.sprite.setTint(0x8a68a0);
      return;
    }

    if (this.phase === 2 && ratio <= 0.33) {
      this.phase = 3;
      context.onPhaseChange(3);
    }
  }

  private moveTowardPlayer(player: Phaser.Physics.Arcade.Sprite): void {
    const direction = new Phaser.Math.Vector2(player.x - this.sprite.x, player.y - this.sprite.y);
    if (direction.lengthSq() < 0.001) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    direction.normalize();
    const speed = this.phase === 3 ? 108 : this.phase === 2 ? 92 : 78;
    this.sprite.setVelocity(direction.x * speed, direction.y * speed);
  }

  private getDefense(): number {
    return this.phase === 3 ? 8 : 6;
  }

  private getAttackRange(): number {
    return this.phase === 3 ? 64 : 56;
  }

  private getAttackDamage(): number {
    return this.phase === 3 ? 28 : this.phase === 2 ? 24 : 20;
  }

  private getAttackCooldown(): number {
    return this.phase === 3 ? 0.95 : this.phase === 2 ? 1.25 : 1.65;
  }

  private getTelegraphDuration(): number {
    return this.phase === 3 ? 0.24 : this.phase === 2 ? 0.3 : 0.4;
  }
}
