import Phaser from 'phaser';
import { defaultContent } from '../content/defaultContent';
import { DialogueRuntime, type DialogueStateAccess } from '../systems/dialogue/DialogueRuntime';
import { SaveRepository } from '../systems/save/SaveRepository';
import { CraftingSystem, type CraftRecipe } from '../systems/crafting/CraftingSystem';
import { EnemyController, type EnemyArchetype, type EnemySpawnConfig } from '../systems/combat/EnemyController';
import { GameSession } from '../state/GameSession';
import type { EnemyData } from '../content/schemas';
import type { FactionId } from '../state/types';
import { REGISTRY_KEYS, type UiPanel } from '../ui/registryKeys';

const TILE_SIZE = 32;
const MAP_WIDTH = 90;
const MAP_HEIGHT = 54;

const DODGE_SPEED = 360;
const DODGE_COST = 24;

interface Interactable {
  id: string;
  label: string;
  kind: 'cache' | 'campfire' | 'foundry' | 'savepoint' | 'npc';
  object: Phaser.Physics.Arcade.Image;
  used: boolean;
  conversationId?: string;
}

interface ActiveDialogue {
  runtime: DialogueRuntime;
  nodeId: string;
  speakerId: string;
}

interface ProjectileData {
  damage: number;
  lifetime: number;
}

export class OverworldScene extends Phaser.Scene {
  private session!: GameSession;
  private readonly saveRepo = new SaveRepository();
  private crafting!: CraftingSystem;

  private player!: Phaser.Physics.Arcade.Sprite;
  private blockers!: Phaser.Physics.Arcade.StaticGroup;
  private projectiles!: Phaser.Physics.Arcade.Group;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  private interactables: Interactable[] = [];
  private enemies: EnemyController[] = [];

  private dodgeDuration = 0;
  private dodgeCooldown = 0;
  private lightCooldown = 0;
  private heavyCooldown = 0;
  private bowCooldown = 0;
  private invulnerableTimer = 0;

  private facing = new Phaser.Math.Vector2(1, 0);
  private currentRegion = 'cinderhaven';
  private autosaveTimer = 0;

  private uiPanel: UiPanel = '';
  private inventoryTab: 'All' | 'Gear' | 'Consumables' | 'Materials' | 'Quest' = 'All';
  private activeDialogue: ActiveDialogue | null = null;

  public constructor() {
    super('overworld');
  }

  public create(): void {
    const bootMode = (this.registry.get('bootMode') as 'new' | 'continue' | undefined) ?? 'new';

    const loadedSave = bootMode === 'continue' ? this.loadContinueSave() : null;
    this.session = new GameSession(loadedSave?.session);

    this.crafting = new CraftingSystem(defaultContent.recipes as CraftRecipe[]);

    this.createMap();
    this.createPlayer();
    this.createInteractables();
    this.createEnemies();
    this.createProjectiles();
    this.setupInput();
    this.setupCamera();
    this.launchUiScenes();

    this.physics.add.collider(this.player, this.blockers);

    for (const enemy of this.enemies) {
      this.physics.add.collider(enemy.sprite, this.blockers);
      this.physics.add.collider(this.player, enemy.sprite);
      this.physics.add.overlap(this.projectiles, enemy.sprite, (projectileObj) => {
        this.handleProjectileHit(projectileObj as Phaser.Physics.Arcade.Image, enemy);
      });
    }

    this.physics.add.collider(this.projectiles, this.blockers, (projectileObj) => {
      projectileObj.destroy();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.uiPanel !== '') {
        return;
      }

      if (pointer.rightButtonDown()) {
        this.tryHeavyAttack();
      } else {
        this.tryLightAttack();
      }
    });

    this.game.events.on('dialogue:select', this.onDialogueChoice, this);
    this.game.events.on('dialogue:cancel', this.closeDialogue, this);

    this.registry.events.on(`changedata-${REGISTRY_KEYS.uiPanel}`, this.onUiPanelChange, this);
    this.registry.events.on(`changedata-${REGISTRY_KEYS.inventory}`, this.onInventoryPanelStateChange, this);

    this.registry.set(REGISTRY_KEYS.uiPanel, '');
    this.publishUiState();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.game.events.off('dialogue:select', this.onDialogueChoice, this);
      this.game.events.off('dialogue:cancel', this.closeDialogue, this);
      this.registry.events.off(`changedata-${REGISTRY_KEYS.uiPanel}`, this.onUiPanelChange, this);
      this.registry.events.off(`changedata-${REGISTRY_KEYS.inventory}`, this.onInventoryPanelStateChange, this);
    });
  }

  public update(_time: number, deltaMs: number): void {
    const delta = deltaMs / 1000;

    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - delta);
    this.lightCooldown = Math.max(0, this.lightCooldown - delta);
    this.heavyCooldown = Math.max(0, this.heavyCooldown - delta);
    this.bowCooldown = Math.max(0, this.bowCooldown - delta);
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - delta);

    this.autosaveTimer += delta;
    if (this.autosaveTimer >= 90) {
      this.autosaveTimer = 0;
      this.saveRepo.save(1, this.session.serialize());
      this.session.log('Autosaved to slot 2.');
    }

    this.handlePanelHotkeys();

    if (this.uiPanel === '' && this.session.isAlive()) {
      this.handleMovement(delta);
      this.handleActions();
      this.updateEnemies(delta);
    } else {
      this.player.setVelocity(0, 0);
    }

    this.updateProjectiles(delta);
    this.session.regenStamina(delta);
    this.handleInteractionPrompt();
    this.updateRegionTracking();

    const lookAhead = this.computeLookAhead();
    this.cameras.main.followOffset.set(lookAhead.x, lookAhead.y);

    this.publishUiState();
  }

  private createMap(): void {
    this.blockers = this.physics.add.staticGroup();

    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        const border = x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1;
        const wallClusters =
          (x > 8 && x < 16 && y > 8 && y < 12) ||
          (x > 24 && x < 31 && y > 14 && y < 18) ||
          (x > 38 && x < 46 && y > 10 && y < 14) ||
          (x > 58 && x < 69 && y > 23 && y < 27) ||
          (x > 72 && x < 85 && y > 35 && y < 39);

        const water = x > 16 && x < 25 && y > 31 && y < 45;
        const marsh = x > 64 && x < 86 && y > 6 && y < 20;
        const path = (y > 24 && y < 30 && x > 4 && x < 62) || (x > 54 && x < 60 && y > 12 && y < 40);
        const blocked = border || wallClusters;

        if (water) {
          this.add.image(px, py, 'tile-water').setOrigin(0);
        } else if (marsh) {
          this.add.image(px, py, 'tile-marsh').setOrigin(0);
        } else if (path) {
          this.add.image(px, py, 'tile-path').setOrigin(0);
        } else {
          this.add.image(px, py, blocked ? 'tile-wall' : 'tile-ground').setOrigin(0);
        }

        if (blocked) {
          const obstacle = this.blockers.create(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 'tile-wall');
          obstacle.refreshBody();
        }
      }
    }

    this.physics.world.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(7 * TILE_SIZE, 8 * TILE_SIZE, 'player');
    this.player.setDepth(5);
    this.player.setDrag(900, 900);
    this.player.setCollideWorldBounds(true);
    this.player.setSize(20, 26);
    this.player.setOffset(6, 4);
  }

  private createInteractables(): void {
    const createStatic = (x: number, y: number, texture: string): Phaser.Physics.Arcade.Image => {
      return this.physics.add.staticImage(x * TILE_SIZE, y * TILE_SIZE, texture).setDepth(4).setScale(0.95);
    };

    this.interactables = [
      {
        id: 'npc-archivist-lyra',
        label: 'Archivist Lyra',
        kind: 'npc',
        object: createStatic(11, 9, 'npc-archivist'),
        used: false,
        conversationId: 'archivist_intro'
      },
      {
        id: 'npc-rook',
        label: 'Master Rook',
        kind: 'npc',
        object: createStatic(21, 11, 'npc-rook'),
        used: false,
        conversationId: 'rook_foundry'
      },
      {
        id: 'npc-pilgrim',
        label: 'Pilgrim Neris',
        kind: 'npc',
        object: createStatic(29, 26, 'npc-pilgrim'),
        used: false,
        conversationId: 'pilgrim_warning'
      },
      {
        id: 'cache-ruin',
        label: 'Anchor Cache',
        kind: 'cache',
        object: createStatic(19, 10, 'chest'),
        used: false
      },
      {
        id: 'foundry-bench',
        label: 'Foundry Bench',
        kind: 'foundry',
        object: createStatic(24, 12, 'foundry'),
        used: false
      },
      {
        id: 'campfire-a',
        label: 'Campfire',
        kind: 'campfire',
        object: createStatic(8, 29, 'campfire'),
        used: false
      },
      {
        id: 'savepoint-a',
        label: 'Anchor Beacon',
        kind: 'savepoint',
        object: createStatic(10, 30, 'savepoint'),
        used: false
      }
    ];
  }

  private createEnemies(): void {
    const archetypes = this.createEnemyArchetypes();

    const spawns: EnemySpawnConfig[] = [
      { enemyId: 'siltling', x: 35 * TILE_SIZE, y: 18 * TILE_SIZE, patrolRadius: 80 },
      { enemyId: 'siltling', x: 42 * TILE_SIZE, y: 24 * TILE_SIZE, patrolRadius: 74 },
      { enemyId: 'grove_stalker', x: 58 * TILE_SIZE, y: 17 * TILE_SIZE, patrolRadius: 64 },
      { enemyId: 'grove_stalker', x: 64 * TILE_SIZE, y: 29 * TILE_SIZE, patrolRadius: 90 },
      { enemyId: 'quarry_brute', x: 72 * TILE_SIZE, y: 34 * TILE_SIZE, patrolRadius: 60 },
      { enemyId: 'quarry_brute', x: 81 * TILE_SIZE, y: 42 * TILE_SIZE, patrolRadius: 66 }
    ];

    this.enemies = spawns
      .map((spawn) => {
        const archetype = archetypes.get(spawn.enemyId);
        if (!archetype) {
          return null;
        }
        return new EnemyController(this, archetype, spawn);
      })
      .filter((entry): entry is EnemyController => Boolean(entry));
  }

  private createProjectiles(): void {
    this.projectiles = this.physics.add.group();
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard?.createCursorKeys() as Phaser.Types.Input.Keyboard.CursorKeys;

    this.wasd = {
      up: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W) as Phaser.Input.Keyboard.Key,
      down: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S) as Phaser.Input.Keyboard.Key,
      left: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A) as Phaser.Input.Keyboard.Key,
      right: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D) as Phaser.Input.Keyboard.Key
    };

    const make = (key: number): Phaser.Input.Keyboard.Key =>
      this.input.keyboard?.addKey(key) as Phaser.Input.Keyboard.Key;

    this.keys = {
      interact: make(Phaser.Input.Keyboard.KeyCodes.E),
      dodge: make(Phaser.Input.Keyboard.KeyCodes.SPACE),
      light: make(Phaser.Input.Keyboard.KeyCodes.J),
      heavy: make(Phaser.Input.Keyboard.KeyCodes.K),
      bow: make(Phaser.Input.Keyboard.KeyCodes.L),
      block: make(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      inventory: make(Phaser.Input.Keyboard.KeyCodes.I),
      character: make(Phaser.Input.Keyboard.KeyCodes.C),
      quests: make(Phaser.Input.Keyboard.KeyCodes.Q),
      map: make(Phaser.Input.Keyboard.KeyCodes.M),
      settings: make(Phaser.Input.Keyboard.KeyCodes.ESC),
      weapon1: make(Phaser.Input.Keyboard.KeyCodes.ONE),
      weapon2: make(Phaser.Input.Keyboard.KeyCodes.TWO),
      weapon3: make(Phaser.Input.Keyboard.KeyCodes.THREE),
      save: make(Phaser.Input.Keyboard.KeyCodes.F5)
    };
  }

  private setupCamera(): void {
    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setZoom(2);
  }

  private launchUiScenes(): void {
    for (const key of ['hud', 'inventory-ui', 'character-ui', 'quest-journal-ui', 'world-map-ui', 'dialogue-ui']) {
      if (!this.scene.isActive(key)) {
        this.scene.launch(key);
      }
    }
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
      this.facing.copy(direction);
    }

    if (this.dodgeDuration > 0) {
      this.dodgeDuration -= delta;
      this.player.setVelocity(this.facing.x * DODGE_SPEED, this.facing.y * DODGE_SPEED);
      return;
    }

    const dodgeCost = DODGE_COST;
    if (Phaser.Input.Keyboard.JustDown(this.keys.dodge) && this.dodgeCooldown <= 0 && this.session.spendStamina(dodgeCost)) {
      this.dodgeDuration = 0.17;
      this.dodgeCooldown = 0.45;
      this.invulnerableTimer = 0.19;
      this.player.setVelocity(this.facing.x * DODGE_SPEED, this.facing.y * DODGE_SPEED);
      this.session.log('Dodge roll.');
      return;
    }

    const speed = this.session.getMoveSpeed() * (this.keys.block.isDown ? 0.72 : 1);
    this.player.setVelocity(direction.x * speed, direction.y * speed);
  }

  private handleActions(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.light)) {
      this.tryLightAttack();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.heavy)) {
      this.tryHeavyAttack();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.bow)) {
      this.tryBowShot();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
      this.interact();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.weapon1)) {
      this.session.setWeaponMode('sword');
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.weapon2)) {
      this.session.setWeaponMode('spear');
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.weapon3)) {
      this.session.setWeaponMode('bow');
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.save)) {
      this.saveRepo.save(0, this.session.serialize());
      this.session.log('Manual save written to slot 1.');
    }
  }

  private handlePanelHotkeys(): void {
    if (this.uiPanel === 'dialogue') {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.inventory)) {
      this.togglePanel('inventory');
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.character)) {
      this.togglePanel('character');
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.quests)) {
      this.togglePanel('quests');
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.map)) {
      this.togglePanel('map');
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.settings)) {
      if (this.uiPanel === '') {
        this.registry.set(REGISTRY_KEYS.uiPanel, 'settings');
        this.scene.pause();
        this.scene.launch('settings-menu', { from: 'game' });
      } else {
        this.registry.set(REGISTRY_KEYS.uiPanel, '');
      }
    }
  }

  private togglePanel(panel: Exclude<UiPanel, '' | 'dialogue' | 'settings' | 'credits' | 'pause'>): void {
    const next = this.uiPanel === panel ? '' : panel;
    this.registry.set(REGISTRY_KEYS.uiPanel, next);
  }

  private tryLightAttack(): void {
    if (this.lightCooldown > 0 || this.heavyCooldown > 0) {
      return;
    }

    this.lightCooldown = 0.32;

    const weaponMode = this.session.getWeaponMode();
    const range = weaponMode === 'spear' ? 82 : 56;
    const arc = weaponMode === 'spear' ? 40 : 70;
    const damage = this.session.getAttackPower(weaponMode === 'spear' ? 16 : 13);

    this.spawnSlash('slash-light', range);
    this.performMeleeDamage(range, arc, damage);
    this.session.log(`${weaponMode} light strike.`);
  }

  private tryHeavyAttack(): void {
    if (this.heavyCooldown > 0 || this.lightCooldown > 0) {
      return;
    }

    const baseCost = 22;
    const finalCost = Math.ceil(baseCost * (1 - this.session.getHeavyStaminaDiscount()));

    if (!this.session.spendStamina(finalCost)) {
      this.session.log('Not enough stamina for heavy attack.');
      return;
    }

    this.heavyCooldown = 0.95;

    this.time.delayedCall(170, () => {
      const damage = Math.floor(this.session.getAttackPower(24) * this.session.getHeavyDamageMultiplier());
      this.spawnSlash('slash-heavy', 72);
      this.performMeleeDamage(72, 90, damage);
      this.session.log('Heavy attack landed.');
    });
  }

  private tryBowShot(): void {
    if (this.bowCooldown > 0) {
      return;
    }

    const weaponMode = this.session.getWeaponMode();
    if (weaponMode !== 'bow') {
      this.session.log('Switch to Bow stance (3) to fire.');
      return;
    }

    if (!this.session.spendStamina(8)) {
      this.session.log('Not enough stamina for bow shot.');
      return;
    }

    this.bowCooldown = 0.44;

    const pointer = this.input.activePointer;
    const dx = pointer.worldX - this.player.x;
    const dy = pointer.worldY - this.player.y;
    const direction = new Phaser.Math.Vector2(dx, dy);

    if (direction.lengthSq() < 0.001) {
      direction.copy(this.facing);
    } else {
      direction.normalize();
      this.facing.copy(direction);
    }

    const projectile = this.projectiles.create(
      this.player.x + direction.x * 18,
      this.player.y + direction.y * 18,
      'arrow'
    ) as Phaser.Physics.Arcade.Image;

    projectile.setDepth(6);
    projectile.setVelocity(direction.x * 370, direction.y * 370);
    projectile.setRotation(direction.angle());

    projectile.setData('combat', {
      damage: this.session.getAttackPower(8) + this.session.getBowBonusDamage(),
      lifetime: 1.1
    } as ProjectileData);

    this.session.log('Bow shot released.');
  }

  private performMeleeDamage(range: number, arcDeg: number, baseDamage: number): void {
    const pointer = this.input.activePointer;
    const aim = new Phaser.Math.Vector2(pointer.worldX - this.player.x, pointer.worldY - this.player.y);

    if (aim.lengthSq() > 0.001) {
      aim.normalize();
      this.facing.copy(aim);
    }

    const hitTargets = new Set<EnemyController>();

    for (const enemy of this.enemies) {
      if (enemy.isDead()) {
        continue;
      }

      const toEnemy = new Phaser.Math.Vector2(enemy.sprite.x - this.player.x, enemy.sprite.y - this.player.y);
      const distance = toEnemy.length();
      if (distance > range) {
        continue;
      }

      toEnemy.normalize();
      const angle = Phaser.Math.RadToDeg(Math.acos(Phaser.Math.Clamp(this.facing.dot(toEnemy), -1, 1)));
      if (angle > arcDeg / 2) {
        continue;
      }

      hitTargets.add(enemy);
    }

    for (const enemy of hitTargets) {
      const result = enemy.receiveDamage(baseDamage, this.session, this.player.x, this.player.y);
      if (result.killed) {
        this.handleEnemyKilled(enemy);
      } else {
        this.session.log(`${enemy.archetype.name} hit for ${result.damage}.`);
      }
    }
  }

  private spawnSlash(texture: 'slash-light' | 'slash-heavy', distance: number): void {
    const slash = this.add
      .image(this.player.x + this.facing.x * (distance * 0.4), this.player.y + this.facing.y * (distance * 0.4), texture)
      .setDepth(7)
      .setRotation(this.facing.angle());

    this.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.2,
      duration: 130,
      onComplete: () => slash.destroy()
    });
  }

  private handleProjectileHit(projectile: Phaser.Physics.Arcade.Image, enemy: EnemyController): void {
    if (!projectile.active || enemy.isDead()) {
      return;
    }

    const combat = projectile.getData('combat') as ProjectileData | undefined;
    if (!combat) {
      projectile.destroy();
      return;
    }

    const result = enemy.receiveDamage(combat.damage, this.session, projectile.x, projectile.y);
    projectile.destroy();

    if (result.killed) {
      this.handleEnemyKilled(enemy);
    } else {
      this.session.log(`${enemy.archetype.name} pierced for ${result.damage}.`);
    }
  }

  private updateProjectiles(delta: number): void {
    this.projectiles.getChildren().forEach((obj) => {
      const projectile = obj as Phaser.Physics.Arcade.Image;
      const combat = projectile.getData('combat') as ProjectileData | undefined;
      if (!combat) {
        projectile.destroy();
        return;
      }

      combat.lifetime -= delta;
      projectile.setData('combat', combat);

      if (combat.lifetime <= 0) {
        projectile.destroy();
      }
    });
  }

  private updateEnemies(delta: number): void {
    const playerBlocking = this.keys.block.isDown;

    for (const enemy of this.enemies) {
      enemy.update({
        delta,
        player: this.player,
        playerBlocking,
        canDamagePlayer: this.invulnerableTimer <= 0,
        onDealDamage: (damage) => {
          const taken = this.session.receiveDamage(damage, playerBlocking);
          this.session.log(`${enemy.archetype.name} hits for ${taken}.`);
          if ((this.registry.get(REGISTRY_KEYS.settings) as { screenShake?: boolean } | undefined)?.screenShake !== false) {
            this.cameras.main.shake(90, 0.003);
          }
        }
      });
    }

    if (!this.session.isAlive()) {
      this.registry.set(REGISTRY_KEYS.uiPanel, '');
      this.session.log('Defeat. Press F5 at a beacon after revival.');
      this.session.restAtCheckpoint();
      this.player.setPosition(10 * TILE_SIZE, 30 * TILE_SIZE);
      this.saveRepo.save(2, this.session.serialize());
      this.session.log('Emergency respawn at beacon.');
    }
  }

  private handleEnemyKilled(enemy: EnemyController): void {
    enemy.applyDeathRewards(this.session);
    this.session.log(`${enemy.archetype.name} defeated.`);

    if (enemy.archetype.id === 'siltling') {
      this.session.advanceQuestObjective('bounty_clear_siltlings', 'kill_siltlings', 1);
    }

    const body = enemy.sprite.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.enable = false;
    }
    enemy.sprite.setVisible(false);
  }

  private interact(): void {
    const nearest = this.getNearestInteractable(58);
    if (!nearest) {
      this.session.log('No interaction target.');
      return;
    }

    switch (nearest.kind) {
      case 'cache':
        if (!nearest.used) {
          nearest.used = true;
          const bonus = Math.floor(this.session.getPerkEffect('cacheCinders'));
          this.session.addItem('key_anchor_dust', 1);
          this.session.addCinders(25 + bonus);
          this.session.awardXp(30);
          this.session.advanceQuestObjective('main_find_anchordust', 'loot_cache', 1);
          this.session.log('Cache opened: Anchor Dust secured.');
          nearest.object.setTint(0x5d4f3a);
        } else {
          this.session.log('Cache is empty.');
        }
        break;
      case 'campfire':
        this.session.restAtCheckpoint();
        this.saveRepo.save(1, this.session.serialize());
        this.session.log('Rested and autosaved (slot 2).');
        break;
      case 'foundry': {
        const recipes = this.crafting.listRecipes('foundry');
        const recipe = recipes[0];
        if (!recipe) {
          this.session.log('No foundry recipes unlocked.');
          break;
        }

        const crafted = this.crafting.craft(recipe.id, this.session.inventory, this.session.getCinders());
        if (!crafted.crafted) {
          this.session.log('Foundry: insufficient materials/cinders.');
          break;
        }

        const spent = this.session.getCinders() - crafted.newCinders;
        if (spent > 0) {
          this.session.spendCinders(spent);
        }
        this.session.advanceQuestObjective('faction_foundry_trial', 'visit_foundry', 1);
        this.session.log(`Crafted ${recipe.name}.`);
        break;
      }
      case 'savepoint':
        this.saveRepo.save(0, this.session.serialize());
        this.session.log('Manual save complete (slot 1).');
        break;
      case 'npc':
        if (nearest.conversationId) {
          if (nearest.id === 'npc-rook') {
            this.session.advanceQuestObjective('main_find_anchordust', 'talk_rook', 1);
          }

          this.beginDialogue(nearest.conversationId, nearest.label);
        }
        break;
      default:
        break;
    }
  }

  private beginDialogue(conversationId: string, speakerLabel: string): void {
    const conversation = this.session.getDialogue(conversationId);
    if (!conversation) {
      this.session.log(`Missing dialogue: ${conversationId}`);
      return;
    }

    const runtime = new DialogueRuntime(conversation as never, this.createDialogueStateAdapter());
    this.activeDialogue = {
      runtime,
      nodeId: 'start',
      speakerId: speakerLabel
    };

    this.registry.set(REGISTRY_KEYS.uiPanel, 'dialogue');
    this.publishDialogueNode();
  }

  private onDialogueChoice(choiceId: string): void {
    if (!this.activeDialogue) {
      return;
    }

    if (choiceId === '__leave_dialogue') {
      this.closeDialogue();
      return;
    }

    const choices = this.activeDialogue.runtime.getAvailableChoices(this.activeDialogue.nodeId);
    const choice = choices.find((entry) => entry.id === choiceId);

    if (!choice) {
      return;
    }

    const nextNodeId = this.activeDialogue.runtime.applyChoice(choice);
    this.activeDialogue.nodeId = nextNodeId;

    this.session.quests.syncAvailability();

    this.publishDialogueNode();
  }

  private publishDialogueNode(): void {
    if (!this.activeDialogue) {
      return;
    }

    const node = this.activeDialogue.runtime.getNode(this.activeDialogue.nodeId);
    const choices = this.activeDialogue.runtime.getAvailableChoices(this.activeDialogue.nodeId);

    this.registry.set(REGISTRY_KEYS.dialogue, {
      speakerId: node.speakerId,
      text: node.text,
      portrait: (node as { portrait?: string }).portrait,
      choices:
        choices.length > 0
          ? choices.map((choice) => ({ id: choice.id, text: choice.text }))
          : [{ id: '__leave_dialogue', text: 'Leave' }]
    });
  }

  private closeDialogue(): void {
    if (!this.activeDialogue) {
      return;
    }

    this.activeDialogue = null;
    this.registry.set(REGISTRY_KEYS.uiPanel, '');
    this.registry.set(REGISTRY_KEYS.dialogue, {
      speakerId: '',
      text: '',
      choices: []
    });
  }

  private handleInteractionPrompt(): void {
    if (this.uiPanel === 'dialogue') {
      this.registry.set(REGISTRY_KEYS.interaction, 'Dialogue active');
      return;
    }

    const nearest = this.getNearestInteractable(60);

    if (!nearest) {
      this.registry.set(REGISTRY_KEYS.interaction, '');
      return;
    }

    this.registry.set(REGISTRY_KEYS.interaction, `E: ${nearest.label}`);
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

  private updateRegionTracking(): void {
    const x = this.player.x / TILE_SIZE;
    const y = this.player.y / TILE_SIZE;

    let region = 'cinderhaven';

    if (x > 52 && y < 24) {
      region = 'gloamwood';
    } else if (x > 52 && y >= 24) {
      region = 'salt_quarry';
    } else if (x > 70 && y < 20) {
      region = 'mirror_marsh';
    } else if (x > 78 && y > 34) {
      region = 'sunken_spire';
    }

    if (region !== this.currentRegion) {
      this.currentRegion = region;
      this.session.discoverRegion(region);
    }
  }

  private publishUiState(): void {
    this.registry.set(REGISTRY_KEYS.hud, this.session.getHudViewModel());

    this.registry.set(REGISTRY_KEYS.inventory, {
      entries: this.session.getInventoryEntries(),
      activeTab: this.inventoryTab,
      cinders: this.session.getCinders(),
      equipment: this.session.getEquipment()
    });

    const stats = this.session.getStats();
    this.registry.set(REGISTRY_KEYS.character, {
      stats,
      perkPoints: this.session.perks.getPoints(),
      perks: this.session.perks.getAllDefinitions().map((perk) => ({
        id: perk.id,
        branch: perk.branch,
        name: perk.name,
        description: perk.description,
        rank: this.session.perks.getRank(perk.id),
        maxRank: perk.maxRank
      })),
      reputations: {
        archivists: this.session.getReputation('archivists'),
        pilgrims: this.session.getReputation('pilgrims'),
        foundry: this.session.getReputation('foundry')
      }
    });

    this.registry.set(REGISTRY_KEYS.questJournal, {
      quests: this.session.getQuestEntries()
    });

    const regions = this.session.getRegions();
    this.registry.set(REGISTRY_KEYS.worldMap, {
      currentRegion: this.currentRegion,
      unlocked: regions.unlocked,
      discovered: regions.discovered
    });
  }

  private computeLookAhead(): Phaser.Math.Vector2 {
    const pointer = this.input.activePointer;
    const dx = pointer.worldX - this.player.x;
    const dy = pointer.worldY - this.player.y;

    return new Phaser.Math.Vector2(Phaser.Math.Clamp(dx * 0.06, -80, 80), Phaser.Math.Clamp(dy * 0.05, -58, 58));
  }

  private onUiPanelChange(_parent: unknown, panel: UiPanel): void {
    this.uiPanel = panel;
  }

  private onInventoryPanelStateChange(
    _parent: unknown,
    state: { activeTab?: 'All' | 'Gear' | 'Consumables' | 'Materials' | 'Quest' }
  ): void {
    if (state.activeTab) {
      this.inventoryTab = state.activeTab;
    }
  }

  private createEnemyArchetypes(): Map<string, EnemyArchetype> {
    const map = new Map<string, EnemyArchetype>();

    for (const enemy of defaultContent.enemies as EnemyData[]) {
      map.set(enemy.id, {
        id: enemy.id,
        name: enemy.name,
        maxHp: enemy.hp,
        attack: enemy.attack,
        defense: enemy.defense,
        moveSpeed: enemy.speed,
        aggroRange: enemy.id === 'quarry_brute' ? 160 : 210,
        investigateRange: enemy.id === 'quarry_brute' ? 220 : 260,
        attackRange: enemy.id === 'quarry_brute' ? 52 : enemy.id === 'grove_stalker' ? 44 : 40,
        retreatThreshold: enemy.id === 'quarry_brute' ? 0.14 : 0.2,
        xpReward: enemy.id === 'quarry_brute' ? 70 : enemy.id === 'grove_stalker' ? 42 : 26,
        cindersReward: enemy.id === 'quarry_brute' ? 24 : enemy.id === 'grove_stalker' ? 14 : 8
      });
    }

    return map;
  }

  private createDialogueStateAdapter(): DialogueStateAccess {
    return {
      getFlag: (flagId) => this.session.getFlag(flagId),
      setFlag: (flagId, value) => {
        this.session.setFlag(flagId, value);
      },
      getStat: (statId) => {
        const stats = this.session.getStats();
        const index: Record<string, number> = {
          level: stats.level,
          xp: stats.xp,
          xpToNext: stats.xpToNext,
          hp: stats.hp,
          maxHp: stats.maxHp,
          stamina: stats.stamina,
          maxStamina: stats.maxStamina,
          attack: stats.attack,
          defense: stats.defense,
          crit: stats.crit,
          moveSpeed: stats.moveSpeed
        };
        return index[statId] ?? 0;
      },
      getItemCount: (itemId) => this.session.countItem(itemId),
      addItem: (itemId, amount) => {
        this.session.addItem(itemId, amount);
      },
      getReputation: (factionId) => {
        return this.session.getReputation((factionId as FactionId) ?? 'archivists');
      },
      addReputation: (factionId, amount) => {
        this.session.addReputation((factionId as FactionId) ?? 'archivists', amount);
      },
      getQuestStatus: (questId) => this.session.getQuestStatus(questId),
      startQuest: (questId) => this.session.startQuest(questId),
      completeQuest: (questId) => this.session.completeQuest(questId)
    };
  }

  private loadContinueSave() {
    const slots = this.saveRepo.listSlots().filter((entry) => entry.exists);
    if (slots.length === 0) {
      return null;
    }

    const ranked = [...slots].sort((a, b) => {
      if (!a.timestamp || a.timestamp === 'corrupted') {
        return 1;
      }
      if (!b.timestamp || b.timestamp === 'corrupted') {
        return -1;
      }
      return a.timestamp < b.timestamp ? 1 : -1;
    });

    for (const slot of ranked) {
      const loaded = this.saveRepo.load(slot.slot);
      if (loaded) {
        return loaded;
      }
    }

    return null;
  }
}
