import Phaser from 'phaser';

const TILE_SIZE = 32;
const MAP_WIDTH = 56;
const MAP_HEIGHT = 38;
const BASE_SPEED = 140;
const DODGE_SPEED = 340;
const DODGE_COST = 25;
const HEAVY_COST = 20;

interface HudSnapshot {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  level: number;
  cinders: number;
  questHint: string;
  events: string[];
}

interface Interactable {
  id: string;
  label: string;
  object: Phaser.Physics.Arcade.Image;
  used: boolean;
}

export class OverworldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private blockers!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private keys!: {
    interact: Phaser.Input.Keyboard.Key;
    dodge: Phaser.Input.Keyboard.Key;
    light: Phaser.Input.Keyboard.Key;
    heavy: Phaser.Input.Keyboard.Key;
  };
  private interactables: Interactable[] = [];
  private eventLog: string[] = [];

  private stamina = 100;
  private maxStamina = 100;
  private hp = 100;
  private maxHp = 100;
  private level = 1;
  private cinders = 20;

  private dodgeDuration = 0;
  private dodgeDirection = new Phaser.Math.Vector2(1, 0);
  private dodgeCooldown = 0;
  private lightCooldown = 0;
  private heavyCooldown = 0;

  public constructor() {
    super('overworld');
  }

  public create(): void {
    this.createMap();
    this.createPlayer();
    this.createInteractables();
    this.setupInput();
    this.setupCamera();

    this.logEvent('Entered Cinderhaven outskirts.');
    this.registry.set('hud', this.buildHudSnapshot());
    this.registry.set('showInteraction', '');

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.tryHeavyAttack();
      } else {
        this.tryLightAttack();
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners('pointerdown');
    });
  }

  public update(_time: number, deltaMs: number): void {
    const delta = deltaMs / 1000;

    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - delta);
    this.lightCooldown = Math.max(0, this.lightCooldown - delta);
    this.heavyCooldown = Math.max(0, this.heavyCooldown - delta);

    this.handleMovement(delta);
    this.handleActions();
    this.handleInteractionPrompt();

    this.stamina = Math.min(this.maxStamina, this.stamina + delta * 12);

    const lookAhead = this.computeLookAhead();
    this.cameras.main.followOffset.set(lookAhead.x, lookAhead.y);

    this.registry.set('hud', this.buildHudSnapshot());
  }

  private createMap(): void {
    this.blockers = this.physics.add.staticGroup();

    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        const border = x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1;
        const ruinedWall =
          (x > 9 && x < 15 && y > 7 && y < 11) ||
          (x > 25 && x < 34 && y > 16 && y < 19) ||
          (x > 38 && x < 48 && y > 8 && y < 11);
        const shallowWater = x > 18 && x < 24 && y > 23 && y < 30;
        const blocked = border || ruinedWall;

        if (shallowWater) {
          this.add.image(px, py, 'tile-water').setOrigin(0);
          continue;
        }

        this.add.image(px, py, blocked ? 'tile-wall' : 'tile-ground').setOrigin(0);

        if (blocked) {
          const obstacle = this.blockers.create(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 'tile-wall');
          obstacle.refreshBody();
        }
      }
    }

    this.physics.world.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(6 * TILE_SIZE, 7 * TILE_SIZE, 'player');
    this.player.setDepth(2);
    this.player.setDrag(900, 900);
    this.player.setCollideWorldBounds(true);

    this.physics.add.collider(this.player, this.blockers);
  }

  private createInteractables(): void {
    const chest = this.physics.add
      .staticImage(20 * TILE_SIZE, 10 * TILE_SIZE, 'chest')
      .setDepth(2)
      .setScale(0.9);

    const campfire = this.physics.add
      .staticImage(8 * TILE_SIZE, 28 * TILE_SIZE, 'campfire')
      .setDepth(2)
      .setScale(0.9);

    this.interactables = [
      { id: 'archivist-cache', label: 'Old Cache', object: chest, used: false },
      { id: 'rest-fire', label: 'Campfire', object: campfire, used: false }
    ];
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard?.createCursorKeys() as Phaser.Types.Input.Keyboard.CursorKeys;

    this.wasd = {
      up: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W) as Phaser.Input.Keyboard.Key,
      down: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S) as Phaser.Input.Keyboard.Key,
      left: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A) as Phaser.Input.Keyboard.Key,
      right: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D) as Phaser.Input.Keyboard.Key
    };

    this.keys = {
      interact: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E) as Phaser.Input.Keyboard.Key,
      dodge: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE) as Phaser.Input.Keyboard.Key,
      light: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.J) as Phaser.Input.Keyboard.Key,
      heavy: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.K) as Phaser.Input.Keyboard.Key
    };
  }

  private setupCamera(): void {
    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setZoom(2);
  }

  private handleMovement(delta: number): void {
    let moveX = 0;
    let moveY = 0;

    if (this.wasd.left.isDown || this.cursors.left?.isDown) {
      moveX -= 1;
    }
    if (this.wasd.right.isDown || this.cursors.right?.isDown) {
      moveX += 1;
    }
    if (this.wasd.up.isDown || this.cursors.up?.isDown) {
      moveY -= 1;
    }
    if (this.wasd.down.isDown || this.cursors.down?.isDown) {
      moveY += 1;
    }

    const direction = new Phaser.Math.Vector2(moveX, moveY);

    if (direction.lengthSq() > 0) {
      direction.normalize();
      this.dodgeDirection.copy(direction);
    }

    if (this.dodgeDuration > 0) {
      this.dodgeDuration -= delta;
      this.player.setVelocity(this.dodgeDirection.x * DODGE_SPEED, this.dodgeDirection.y * DODGE_SPEED);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.dodge) && this.dodgeCooldown <= 0 && this.stamina >= DODGE_COST) {
      this.stamina -= DODGE_COST;
      this.dodgeDuration = 0.18;
      this.dodgeCooldown = 0.45;
      this.player.setVelocity(this.dodgeDirection.x * DODGE_SPEED, this.dodgeDirection.y * DODGE_SPEED);
      this.logEvent('Dodge roll.');
      return;
    }

    this.player.setVelocity(direction.x * BASE_SPEED, direction.y * BASE_SPEED);
  }

  private handleActions(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.light)) {
      this.tryLightAttack();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.heavy)) {
      this.tryHeavyAttack();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
      this.interact();
    }
  }

  private tryLightAttack(): void {
    if (this.lightCooldown > 0) {
      return;
    }

    this.lightCooldown = 0.28;
    this.logEvent('Light attack.');
  }

  private tryHeavyAttack(): void {
    if (this.heavyCooldown > 0 || this.stamina < HEAVY_COST) {
      return;
    }

    this.heavyCooldown = 0.9;
    this.stamina -= HEAVY_COST;
    this.logEvent('Heavy attack (telegraphed).');
  }

  private interact(): void {
    const nearest = this.getNearestInteractable(50);
    if (!nearest) {
      this.logEvent('Nothing to interact with.');
      return;
    }

    if (nearest.id === 'archivist-cache' && !nearest.used) {
      nearest.used = true;
      this.cinders += 25;
      this.logEvent('Recovered Anchor Dust x1 and 25 Cinders.');
      return;
    }

    if (nearest.id === 'rest-fire') {
      this.hp = this.maxHp;
      this.stamina = this.maxStamina;
      this.logEvent('Rested at campfire. HP and Stamina restored.');
      return;
    }

    this.logEvent(`${nearest.label} has nothing else for now.`);
  }

  private getNearestInteractable(maxDistance: number): Interactable | null {
    let nearest: Interactable | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const interactable of this.interactables) {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        interactable.object.x,
        interactable.object.y
      );

      if (distance <= maxDistance && distance < bestDistance) {
        nearest = interactable;
        bestDistance = distance;
      }
    }

    return nearest;
  }

  private handleInteractionPrompt(): void {
    const nearest = this.getNearestInteractable(56);

    if (!nearest) {
      this.registry.set('showInteraction', '');
      return;
    }

    this.registry.set('showInteraction', `E: ${nearest.label}`);
  }

  private computeLookAhead(): Phaser.Math.Vector2 {
    const pointer = this.input.activePointer;
    const dx = pointer.worldX - this.player.x;
    const dy = pointer.worldY - this.player.y;

    return new Phaser.Math.Vector2(Phaser.Math.Clamp(dx * 0.07, -70, 70), Phaser.Math.Clamp(dy * 0.07, -50, 50));
  }

  private buildHudSnapshot(): HudSnapshot {
    return {
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      stamina: Math.round(this.stamina),
      maxStamina: this.maxStamina,
      level: this.level,
      cinders: this.cinders,
      questHint: 'Main: Find a way into Gloamwood ruins.',
      events: [...this.eventLog]
    };
  }

  private logEvent(message: string): void {
    this.eventLog = [message, ...this.eventLog].slice(0, 5);
  }
}
