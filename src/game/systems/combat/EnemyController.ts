import Phaser from 'phaser';
import type { GameSession } from '../../state/GameSession';

export type EnemyState = 'patrol' | 'investigate' | 'chase' | 'attack_telegraph' | 'retreat' | 'dead';
export type EnemyAiProfile = 'ai_melee_basic' | 'ai_skirmisher' | 'ai_tank' | 'ai_ranged_wisp';

export interface EnemyArchetype {
  id: string;
  name: string;
  maxHp: number;
  attack: number;
  defense: number;
  moveSpeed: number;
  aggroRange: number;
  investigateRange: number;
  attackRange: number;
  retreatThreshold: number;
  xpReward: number;
  cindersReward: number;
  lootTableId: string;
  aiProfileId: EnemyAiProfile;
  hitbox: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
}

export interface EnemySpawnConfig {
  enemyId: string;
  x: number;
  y: number;
  patrolRadius: number;
}

export interface EnemyUpdateContext {
  delta: number;
  player: Phaser.Physics.Arcade.Sprite;
  playerBlocking: boolean;
  canDamagePlayer: boolean;
  onDealDamage: (damage: number) => void;
}

export class EnemyController {
  public readonly sprite: Phaser.Physics.Arcade.Sprite;
  public readonly archetype: EnemyArchetype;

  private hp: number;
  private state: EnemyState = 'patrol';
  private patrolOrigin: Phaser.Math.Vector2;
  private patrolTarget: Phaser.Math.Vector2;
  private investigateTarget: Phaser.Math.Vector2;
  private attackCooldown = 0;
  private telegraphTimer = 0;
  private hitFlash = 0;

  public constructor(
    private readonly scene: Phaser.Scene,
    archetype: EnemyArchetype,
    spawn: EnemySpawnConfig
  ) {
    this.archetype = archetype;
    this.hp = archetype.maxHp;

    this.sprite = this.scene.physics.add.sprite(spawn.x, spawn.y, `enemy-${archetype.id}`);
    this.sprite.setScale(2);
    this.sprite.setDepth(2);
    this.sprite.setSize(archetype.hitbox.width, archetype.hitbox.height);
    this.sprite.setOffset(archetype.hitbox.offsetX, archetype.hitbox.offsetY);
    this.sprite.setCollideWorldBounds(true);

    if (this.isRangedProfile()) {
      this.sprite.setTint(0x87c7bf);
    }

    this.patrolOrigin = new Phaser.Math.Vector2(spawn.x, spawn.y);
    this.patrolTarget = this.randomPatrolTarget(spawn.patrolRadius);
    this.investigateTarget = new Phaser.Math.Vector2(spawn.x, spawn.y);
  }

  public getState(): EnemyState {
    return this.state;
  }

  public getHpRatio(): number {
    return this.hp / this.archetype.maxHp;
  }

  public isDead(): boolean {
    return this.state === 'dead';
  }

  public update(context: EnemyUpdateContext): void {
    if (!this.sprite.active) {
      return;
    }

    if (this.state === 'dead') {
      const body = this.sprite.body as Phaser.Physics.Arcade.Body | null;
      if (body?.enable) {
        this.sprite.setVelocity(0, 0);
      }
      return;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - context.delta);
    this.telegraphTimer = Math.max(0, this.telegraphTimer - context.delta);
    this.hitFlash = Math.max(0, this.hitFlash - context.delta);

    if (this.hitFlash <= 0) {
      this.sprite.clearTint();
      if (this.isRangedProfile()) {
        this.sprite.setTint(0x87c7bf);
      }
    }

    const distanceToPlayer = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      context.player.x,
      context.player.y
    );

    if (this.hp <= this.archetype.maxHp * this.archetype.retreatThreshold && this.state !== 'retreat') {
      this.state = 'retreat';
    }

    switch (this.state) {
      case 'patrol':
        this.updatePatrol(context.delta);
        if (distanceToPlayer <= this.archetype.aggroRange) {
          this.state = 'chase';
        } else if (distanceToPlayer <= this.archetype.investigateRange) {
          this.state = 'investigate';
          this.investigateTarget.set(context.player.x, context.player.y);
        }
        break;
      case 'investigate':
        this.moveToTarget(this.investigateTarget, this.archetype.moveSpeed * 0.85);
        if (distanceToPlayer <= this.archetype.aggroRange) {
          this.state = 'chase';
        } else if (
          Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.investigateTarget.x, this.investigateTarget.y) < 8
        ) {
          this.state = 'patrol';
        }
        break;
      case 'chase':
        if (this.isRangedProfile()) {
          this.updateRangedPositioning(context.player, distanceToPlayer);
        } else {
          this.moveToTarget(new Phaser.Math.Vector2(context.player.x, context.player.y), this.archetype.moveSpeed);
        }

        if (distanceToPlayer <= this.archetype.attackRange && this.attackCooldown <= 0) {
          this.state = 'attack_telegraph';
          this.telegraphTimer = this.getTelegraphDuration();
          this.sprite.setTint(0xe4bc6c);
        } else if (distanceToPlayer > this.getAggroLeash()) {
          this.state = 'investigate';
          this.investigateTarget.set(context.player.x, context.player.y);
        }
        break;
      case 'attack_telegraph':
        this.sprite.setVelocity(0, 0);
        if (this.telegraphTimer <= 0) {
          this.attackCooldown = this.getAttackCooldown();
          this.state = this.hp <= this.archetype.maxHp * this.archetype.retreatThreshold ? 'retreat' : 'chase';

          if (distanceToPlayer <= this.getAttackHitRange() && context.canDamagePlayer) {
            const blockedMul = this.isRangedProfile() ? 0.72 : 0.6;
            const damage = context.playerBlocking ? Math.floor(this.archetype.attack * blockedMul) : this.archetype.attack;
            context.onDealDamage(damage);
          }

          this.sprite.clearTint();
          if (this.isRangedProfile()) {
            this.sprite.setTint(0x87c7bf);
          }
        }
        break;
      case 'retreat': {
        const away = new Phaser.Math.Vector2(this.sprite.x - context.player.x, this.sprite.y - context.player.y);
        if (away.lengthSq() <= 0.001) {
          away.set(1, 0);
        }

        away.normalize();
        this.sprite.setVelocity(away.x * this.archetype.moveSpeed, away.y * this.archetype.moveSpeed);

        if (distanceToPlayer > this.archetype.aggroRange * 1.2) {
          this.state = 'patrol';
          this.patrolTarget = this.randomPatrolTarget(48);
        }
        break;
      }
      default:
        this.sprite.setVelocity(0, 0);
    }
  }

  public receiveDamage(baseDamage: number, session: GameSession, fromX: number, fromY: number): { killed: boolean; damage: number } {
    if (this.state === 'dead' || !this.sprite.active) {
      return { killed: false, damage: 0 };
    }

    const crit = Math.random() < session.getCritChance();
    const rolled = crit ? Math.floor(baseDamage * 1.55) : baseDamage;
    const finalDamage = Math.max(1, rolled - this.archetype.defense);

    this.hp = Math.max(0, this.hp - finalDamage);
    this.state = 'chase';
    this.investigateTarget.set(fromX, fromY);
    this.hitFlash = 0.12;
    this.sprite.setTint(crit ? 0xf8b860 : 0xb35757);

    if (this.hp <= 0) {
      this.state = 'dead';
      this.sprite.setVelocity(0, 0);
      this.sprite.setTint(0x1a1a1a);
      const body = this.sprite.body as Phaser.Physics.Arcade.Body | null;
      if (body) {
        body.enable = false;
      }
      return { killed: true, damage: finalDamage };
    }

    return { killed: false, damage: finalDamage };
  }

  public applyDeathRewards(session: GameSession): void {
    session.awardXp(this.archetype.xpReward);
    session.addCinders(this.archetype.cindersReward);
  }

  public destroy(): void {
    this.sprite.destroy();
  }

  private isRangedProfile(): boolean {
    return this.archetype.aiProfileId === 'ai_ranged_wisp';
  }

  private updatePatrol(_delta: number): void {
    this.moveToTarget(this.patrolTarget, this.archetype.moveSpeed * 0.75);

    const remaining = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      this.patrolTarget.x,
      this.patrolTarget.y
    );

    if (remaining < 8) {
      this.patrolTarget = this.randomPatrolTarget(54);
    }
  }

  private updateRangedPositioning(player: Phaser.Physics.Arcade.Sprite, distanceToPlayer: number): void {
    const desiredMin = this.archetype.attackRange * 0.56;
    const desiredMax = this.archetype.attackRange * 0.9;

    if (distanceToPlayer < desiredMin) {
      const away = new Phaser.Math.Vector2(this.sprite.x - player.x, this.sprite.y - player.y);
      if (away.lengthSq() <= 0.001) {
        away.set(1, 0);
      }
      away.normalize();
      this.sprite.setVelocity(away.x * this.archetype.moveSpeed, away.y * this.archetype.moveSpeed);
      return;
    }

    if (distanceToPlayer > desiredMax) {
      this.moveToTarget(new Phaser.Math.Vector2(player.x, player.y), this.archetype.moveSpeed * 0.88);
      return;
    }

    const toPlayer = new Phaser.Math.Vector2(player.x - this.sprite.x, player.y - this.sprite.y);
    if (toPlayer.lengthSq() <= 0.001) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    toPlayer.normalize();
    const lateral = new Phaser.Math.Vector2(-toPlayer.y, toPlayer.x);
    const driftDirection = Math.sin(this.scene.time.now * 0.0047) > 0 ? 1 : -1;
    const driftSpeed = this.archetype.moveSpeed * 0.55;

    this.sprite.setVelocity(lateral.x * driftSpeed * driftDirection, lateral.y * driftSpeed * driftDirection);
  }

  private moveToTarget(target: Phaser.Math.Vector2, speed: number): void {
    const direction = new Phaser.Math.Vector2(target.x - this.sprite.x, target.y - this.sprite.y);

    if (direction.lengthSq() <= 0.001) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    direction.normalize();
    this.sprite.setVelocity(direction.x * speed, direction.y * speed);
  }

  private getTelegraphDuration(): number {
    if (this.archetype.aiProfileId === 'ai_tank') {
      return 0.44;
    }

    if (this.archetype.aiProfileId === 'ai_skirmisher') {
      return 0.32;
    }

    if (this.isRangedProfile()) {
      return 0.46;
    }

    return 0.38;
  }

  private getAttackCooldown(): number {
    if (this.archetype.aiProfileId === 'ai_tank') {
      return 1.35;
    }

    if (this.archetype.aiProfileId === 'ai_skirmisher') {
      return 1.05;
    }

    if (this.isRangedProfile()) {
      return 1.55;
    }

    return 1.2;
  }

  private getAttackHitRange(): number {
    if (this.isRangedProfile()) {
      return this.archetype.attackRange + 36;
    }

    return this.archetype.attackRange + 10;
  }

  private getAggroLeash(): number {
    if (this.isRangedProfile()) {
      return this.archetype.aggroRange * 1.8;
    }

    return this.archetype.aggroRange * 1.5;
  }

  private randomPatrolTarget(radius: number): Phaser.Math.Vector2 {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const distance = Phaser.Math.FloatBetween(radius * 0.4, radius);

    return new Phaser.Math.Vector2(
      this.patrolOrigin.x + Math.cos(angle) * distance,
      this.patrolOrigin.y + Math.sin(angle) * distance
    );
  }
}
