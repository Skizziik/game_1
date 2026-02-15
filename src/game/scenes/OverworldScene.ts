import Phaser from 'phaser';
import { defaultContent } from '../content/defaultContent';
import type { EnemyData } from '../content/schemas';
import { CraftingSystem, type CraftRecipe } from '../systems/crafting/CraftingSystem';
import { EnemyController, type EnemyArchetype, type EnemySpawnConfig } from '../systems/combat/EnemyController';
import { HollowHartBoss, type HollowHartPhase } from '../systems/combat/HollowHartBoss';
import { DialogueRuntime, type DialogueStateAccess } from '../systems/dialogue/DialogueRuntime';
import { ShopSystem, type ShopListing } from '../systems/economy/ShopSystem';
import { SaveRepository } from '../systems/save/SaveRepository';
import { UpgradeSystem } from '../systems/upgrades/UpgradeSystem';
import { GameSession } from '../state/GameSession';
import type { FactionId } from '../state/types';
import { REGISTRY_KEYS, type UiPanel } from '../ui/registryKeys';

const TILE_SIZE = 32;
const MAP_WIDTH = 90;
const MAP_HEIGHT = 54;

const DODGE_SPEED = 360;
const DODGE_COST = 24;

const HOLLOW_HART_ARENA_X = 76 * TILE_SIZE;
const HOLLOW_HART_ARENA_Y = 13 * TILE_SIZE;
const HOLLOW_HART_START_DISTANCE = 210;
const ROOT_MAX_HP = 88;

const SHOP_LISTINGS: ShopListing[] = [
  {
    id: 'listing_heal_tonic',
    itemId: 'consumable_heal_small',
    displayName: 'Cloudleaf Tincture',
    buyPrice: 18,
    baseStock: 4,
    restockTo: 7,
    maxStack: 20
  },
  {
    id: 'listing_stamina_vial',
    itemId: 'consumable_stamina_vial',
    displayName: 'Quicksilver Draught',
    buyPrice: 24,
    baseStock: 3,
    restockTo: 6,
    maxStack: 20
  },
  {
    id: 'listing_ore_bundle',
    itemId: 'material_iron_ore',
    displayName: 'Iron Ore Bundle',
    buyPrice: 11,
    baseStock: 6,
    restockTo: 10,
    maxStack: 99
  },
  {
    id: 'listing_cloudleaf_bundle',
    itemId: 'material_cloudleaf',
    displayName: 'Cloudleaf Bundle',
    buyPrice: 10,
    baseStock: 6,
    restockTo: 10,
    maxStack: 99
  }
];

interface Interactable {
  id: string;
  label: string;
  kind: 'cache' | 'campfire' | 'foundry' | 'savepoint' | 'npc' | 'shop';
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

interface RootNode {
  sprite: Phaser.Physics.Arcade.Image;
  hp: number;
}

interface ShopPanelState {
  title: string;
  cinders: number;
  restockInSeconds: number;
  listings: Array<{ id: string; label: string; price: number; stock: number }>;
  sellable: Array<{ itemId: string; label: string; amount: number; sellValue: number }>;
  message: string;
}

interface FoundryPanelState {
  cinders: number;
  anchorDust: number;
  weaponLevel: number;
  armorLevel: number;
  options: Array<{ id: string; label: string; cinders: number; anchorDust: number; disabled?: boolean }>;
  message: string;
}

export class OverworldScene extends Phaser.Scene {
  private session!: GameSession;
  private readonly saveRepo = new SaveRepository();
  private readonly upgrades = new UpgradeSystem();
  private crafting!: CraftingSystem;
  private shop!: ShopSystem;

  private player!: Phaser.Physics.Arcade.Sprite;
  private blockers!: Phaser.Physics.Arcade.StaticGroup;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private rootGroup!: Phaser.Physics.Arcade.Group;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  private interactables: Interactable[] = [];
  private enemies: EnemyController[] = [];
  private enemyArchetypes = new Map<string, EnemyArchetype>();

  private hollowHart!: HollowHartBoss;
  private roots: RootNode[] = [];
  private rootsActive = false;
  private rootsHintCooldown = 0;

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

  private shopMessage = 'Trade with the Foundry Guild.';
  private foundryMessage = 'Refine gear, craft supplies, and push deeper into ruins.';

  public constructor() {
    super('overworld');
  }

  public create(): void {
    const bootMode = (this.registry.get('bootMode') as 'new' | 'continue' | undefined) ?? 'new';

    const loadedSave = bootMode === 'continue' ? this.loadContinueSave() : null;
    this.session = new GameSession(loadedSave?.session);

    this.crafting = new CraftingSystem(defaultContent.recipes as CraftRecipe[]);
    this.shop = new ShopSystem(SHOP_LISTINGS, this.session.getShopRuntimeState());

    this.createMap();
    this.createPlayer();
    this.createInteractables();
    this.createProjectiles();
    this.createEnemies();
    this.createBossEncounter();
    this.setupInput();
    this.setupCamera();
    this.launchUiScenes();

    this.physics.add.collider(this.player, this.blockers);
    this.physics.add.collider(this.player, this.rootGroup);
    this.physics.add.collider(this.hollowHart.sprite, this.blockers);
    this.physics.add.collider(this.player, this.hollowHart.sprite);

    for (const enemy of this.enemies) {
      this.bindEnemyPhysics(enemy);
    }

    this.physics.add.collider(this.projectiles, this.blockers, (projectileObj) => {
      projectileObj.destroy();
    });

    this.physics.add.overlap(this.projectiles, this.hollowHart.sprite, (projectileObj) => {
      this.handleProjectileHitBoss(projectileObj as Phaser.Physics.Arcade.Image);
    });

    this.physics.add.overlap(this.projectiles, this.rootGroup, (projectileObj, rootObj) => {
      this.handleProjectileHitRoot(projectileObj as Phaser.Physics.Arcade.Image, rootObj as Phaser.Physics.Arcade.Image);
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
    this.game.events.on('shop:buy', this.onShopBuy, this);
    this.game.events.on('shop:sell', this.onShopSell, this);
    this.game.events.on('foundry:action', this.onFoundryAction, this);

    this.registry.events.on(`changedata-${REGISTRY_KEYS.uiPanel}`, this.onUiPanelChange, this);
    this.registry.events.on(`changedata-${REGISTRY_KEYS.inventory}`, this.onInventoryPanelStateChange, this);

    this.registry.set(REGISTRY_KEYS.uiPanel, '');
    this.publishUiState();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.persistRuntimeState();
      this.input.removeAllListeners();
      this.game.events.off('dialogue:select', this.onDialogueChoice, this);
      this.game.events.off('dialogue:cancel', this.closeDialogue, this);
      this.game.events.off('shop:buy', this.onShopBuy, this);
      this.game.events.off('shop:sell', this.onShopSell, this);
      this.game.events.off('foundry:action', this.onFoundryAction, this);
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
    this.rootsHintCooldown = Math.max(0, this.rootsHintCooldown - delta);

    if (this.shop.tick(delta)) {
      this.shopMessage = 'Fresh stock rolled in from the Foundry caravan.';
      this.session.log('Foundry market has restocked.');
    }

    this.autosaveTimer += delta;
    if (this.autosaveTimer >= 90) {
      this.autosaveTimer = 0;
      this.persistRuntimeState();
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

    this.persistRuntimeState();
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
          this.add.image(px, py, 'tile-water').setOrigin(0).setScale(2);
        } else if (marsh) {
          this.add.image(px, py, 'tile-marsh').setOrigin(0).setScale(2);
        } else if (path) {
          this.add.image(px, py, 'tile-path').setOrigin(0).setScale(2);
        } else {
          this.add.image(px, py, blocked ? 'tile-wall' : 'tile-ground').setOrigin(0).setScale(2);
        }

        if (blocked) {
          const obstacle = this.blockers.create(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 'tile-wall');
          obstacle.setScale(2);
          obstacle.refreshBody();
        }
      }
    }

    this.physics.world.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(7 * TILE_SIZE, 8 * TILE_SIZE, 'player');
    this.player.setScale(2);
    this.player.setDepth(5);
    this.player.setDrag(900, 900);
    this.player.setCollideWorldBounds(true);
    this.player.setSize(18, 20);
    this.player.setOffset(7, 6);
  }

  private createInteractables(): void {
    const createStatic = (x: number, y: number, texture: string): Phaser.Physics.Arcade.Image => {
      return this.physics.add.staticImage(x * TILE_SIZE, y * TILE_SIZE, texture).setDepth(4).setScale(2);
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
        id: 'npc-quartermaster',
        label: 'Quartermaster Voss',
        kind: 'shop',
        object: createStatic(17, 11, 'npc-merchant'),
        used: false
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
    this.enemyArchetypes = this.createEnemyArchetypes();

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
        const archetype = this.enemyArchetypes.get(spawn.enemyId);
        if (!archetype) {
          return null;
        }
        return new EnemyController(this, archetype, spawn);
      })
      .filter((entry): entry is EnemyController => Boolean(entry));
  }

  private createBossEncounter(): void {
    this.hollowHart = new HollowHartBoss(this, HOLLOW_HART_ARENA_X, HOLLOW_HART_ARENA_Y);
    this.rootGroup = this.physics.add.group({ immovable: true, allowGravity: false });

    if (this.session.getFlag('hollow_hart_defeated') === true) {
      this.hollowHart.resetEncounter();
      this.hollowHart.sprite.setVisible(false);
      const body = this.hollowHart.sprite.body as Phaser.Physics.Arcade.Body;
      body.enable = false;
    }
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
    for (const key of [
      'hud',
      'inventory-ui',
      'character-ui',
      'quest-journal-ui',
      'world-map-ui',
      'dialogue-ui',
      'shop-ui',
      'foundry-ui'
    ]) {
      if (!this.scene.isActive(key)) {
        this.scene.launch(key);
      }
    }
  }

  private bindEnemyPhysics(enemy: EnemyController): void {
    this.physics.add.collider(enemy.sprite, this.blockers);
    this.physics.add.collider(enemy.sprite, this.rootGroup);
    this.physics.add.collider(this.player, enemy.sprite);
    this.physics.add.overlap(this.projectiles, enemy.sprite, (projectileObj) => {
      this.handleProjectileHit(projectileObj as Phaser.Physics.Arcade.Image, enemy);
    });
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

    if (Phaser.Input.Keyboard.JustDown(this.keys.dodge) && this.dodgeCooldown <= 0 && this.session.spendStamina(DODGE_COST)) {
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
      this.persistRuntimeState();
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

      if (!this.canHitArc(enemy.sprite.x, enemy.sprite.y, range, arcDeg)) {
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

    this.damageRootsInArc(range, arcDeg, baseDamage);
    this.damageHollowHartInArc(range, arcDeg, baseDamage);
  }

  private canHitArc(targetX: number, targetY: number, range: number, arcDeg: number): boolean {
    const toTarget = new Phaser.Math.Vector2(targetX - this.player.x, targetY - this.player.y);
    const distance = toTarget.length();

    if (distance > range || distance <= 0.001) {
      return false;
    }

    toTarget.normalize();
    const angle = Phaser.Math.RadToDeg(Math.acos(Phaser.Math.Clamp(this.facing.dot(toTarget), -1, 1)));
    return angle <= arcDeg / 2;
  }

  private damageRootsInArc(range: number, arcDeg: number, baseDamage: number): void {
    if (!this.rootsActive || this.roots.length === 0) {
      return;
    }

    const damage = Math.max(8, Math.floor(baseDamage * 0.5));

    for (const root of this.roots) {
      if (!this.canHitArc(root.sprite.x, root.sprite.y, range + 12, arcDeg)) {
        continue;
      }

      root.hp -= damage;
      root.sprite.setTint(0xd09a68);
      this.time.delayedCall(100, () => {
        if (root.sprite.active) {
          root.sprite.clearTint();
        }
      });

      if (root.hp <= 0) {
        root.sprite.destroy();
        this.session.log('A root barrier shattered.');
      }
    }

    this.roots = this.roots.filter((root) => root.sprite.active);
    if (this.roots.length === 0 && this.rootsActive) {
      this.rootsActive = false;
      this.session.log('Root shield collapsed. Hollow Hart is exposed.');
    }
  }

  private damageHollowHartInArc(range: number, arcDeg: number, baseDamage: number): void {
    if (!this.hollowHart.isEncounterStarted() || this.hollowHart.isDead()) {
      return;
    }

    if (!this.canHitArc(this.hollowHart.sprite.x, this.hollowHart.sprite.y, range + 10, arcDeg)) {
      return;
    }

    const result = this.hollowHart.receiveDamage(baseDamage, this.session, this.rootsActive);

    if (result.blockedByRoots) {
      if (this.rootsHintCooldown <= 0) {
        this.rootsHintCooldown = 1.1;
        this.session.log('Roots absorb the strike. Break them first.');
      }
      return;
    }

    if (result.killed) {
      this.handleHollowHartDefeated();
      return;
    }

    this.session.log(`Hollow Hart takes ${result.damage}.`);
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

  private handleProjectileHitBoss(projectile: Phaser.Physics.Arcade.Image): void {
    if (!projectile.active || !this.hollowHart.isEncounterStarted() || this.hollowHart.isDead()) {
      return;
    }

    const combat = projectile.getData('combat') as ProjectileData | undefined;
    if (!combat) {
      projectile.destroy();
      return;
    }

    const result = this.hollowHart.receiveDamage(combat.damage, this.session, this.rootsActive);
    projectile.destroy();

    if (result.blockedByRoots) {
      if (this.rootsHintCooldown <= 0) {
        this.rootsHintCooldown = 1.1;
        this.session.log('Roots absorb the shot.');
      }
      return;
    }

    if (result.killed) {
      this.handleHollowHartDefeated();
      return;
    }

    this.session.log(`Arrow wounds Hollow Hart for ${result.damage}.`);
  }

  private handleProjectileHitRoot(projectile: Phaser.Physics.Arcade.Image, rootSprite: Phaser.Physics.Arcade.Image): void {
    if (!projectile.active || !rootSprite.active || !this.rootsActive) {
      return;
    }

    const combat = projectile.getData('combat') as ProjectileData | undefined;
    projectile.destroy();

    if (!combat) {
      return;
    }

    const root = this.roots.find((entry) => entry.sprite === rootSprite);
    if (!root) {
      return;
    }

    root.hp -= combat.damage;
    root.sprite.setTint(0xcf9b69);
    this.time.delayedCall(100, () => {
      if (root.sprite.active) {
        root.sprite.clearTint();
      }
    });

    if (root.hp <= 0) {
      root.sprite.destroy();
      this.session.log('A root barrier shattered.');
    }

    this.roots = this.roots.filter((entry) => entry.sprite.active);
    if (this.roots.length === 0) {
      this.rootsActive = false;
      this.session.log('Root shield collapsed. Hollow Hart is exposed.');
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

    this.updateHollowHart(delta, playerBlocking);

    if (!this.session.isAlive()) {
      this.registry.set(REGISTRY_KEYS.uiPanel, '');
      this.session.log('Defeat. Press F5 at a beacon after revival.');
      this.session.restAtCheckpoint();
      this.player.setPosition(10 * TILE_SIZE, 30 * TILE_SIZE);

      if (!this.hollowHart.isDead()) {
        this.hollowHart.resetEncounter();
      }
      this.clearRoots();

      this.persistRuntimeState();
      this.saveRepo.save(2, this.session.serialize());
      this.session.log('Emergency respawn at beacon.');
    }
  }

  private updateHollowHart(delta: number, playerBlocking: boolean): void {
    if (this.session.getFlag('hollow_hart_defeated') === true) {
      return;
    }

    if (!this.hollowHart.isEncounterStarted()) {
      const questStatus = this.session.getQuestStatus('main_hollow_hart');
      if (questStatus === 'active') {
        const distanceToArena = Phaser.Math.Distance.Between(this.player.x, this.player.y, HOLLOW_HART_ARENA_X, HOLLOW_HART_ARENA_Y);
        if (distanceToArena <= HOLLOW_HART_START_DISTANCE) {
          this.hollowHart.startEncounter();
          this.session.setFlag('hollow_hart_started', true);
          this.session.log('The Hollow Hart emerges from the grove.');
        }
      }
      return;
    }

    this.hollowHart.update({
      delta,
      player: this.player,
      canDamagePlayer: this.invulnerableTimer <= 0,
      onDealDamage: (damage) => {
        const taken = this.session.receiveDamage(damage, playerBlocking);
        this.session.log(`Hollow Hart mauls for ${taken}.`);
        if ((this.registry.get(REGISTRY_KEYS.settings) as { screenShake?: boolean } | undefined)?.screenShake !== false) {
          this.cameras.main.shake(120, 0.004);
        }
      },
      onPhaseChange: (phase) => this.onHollowHartPhaseChange(phase),
      onSummonAdds: (count) => this.summonHollowHartAdds(count),
      onSummonRoots: () => this.activateRoots(),
      onDefeated: () => this.handleHollowHartDefeated()
    });
  }

  private onHollowHartPhaseChange(phase: HollowHartPhase): void {
    if (phase === 2) {
      this.session.log('Hollow Hart enters phase 2: summons and roots.');
      return;
    }

    if (phase === 3) {
      this.session.log('Hollow Hart enrages. Watch the telegraphs.');
    }
  }

  private summonHollowHartAdds(count: number): void {
    const archetype = this.enemyArchetypes.get('siltling');
    if (!archetype) {
      return;
    }

    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.2, 0.2);
      const spawnX = this.hollowHart.sprite.x + Math.cos(angle) * 58;
      const spawnY = this.hollowHart.sprite.y + Math.sin(angle) * 58;

      const summoned = new EnemyController(this, archetype, {
        enemyId: 'siltling',
        x: spawnX,
        y: spawnY,
        patrolRadius: 42
      });

      this.bindEnemyPhysics(summoned);
      this.enemies.push(summoned);
    }

    this.session.log(`Hollow Hart summons ${count} Siltlings.`);
  }

  private activateRoots(): void {
    this.clearRoots();
    this.rootsActive = true;

    const positions = [
      { x: this.hollowHart.sprite.x - 52, y: this.hollowHart.sprite.y - 30 },
      { x: this.hollowHart.sprite.x + 54, y: this.hollowHart.sprite.y - 24 },
      { x: this.hollowHart.sprite.x - 42, y: this.hollowHart.sprite.y + 38 },
      { x: this.hollowHart.sprite.x + 44, y: this.hollowHart.sprite.y + 40 }
    ];

    this.roots = positions.map((position) => {
      const root = this.physics.add.image(position.x, position.y, 'boss-root').setDepth(6).setScale(2.2).setImmovable(true);
      root.setTint(0x54704f);
      const body = root.body as Phaser.Physics.Arcade.Body;
      body.allowGravity = false;
      body.moves = false;
      this.rootGroup.add(root);
      return { sprite: root, hp: ROOT_MAX_HP };
    });

    this.session.log('Root shield raised. Destroy roots to damage the boss.');
  }

  private clearRoots(): void {
    for (const root of this.roots) {
      if (root.sprite.active) {
        root.sprite.destroy();
      }
    }

    this.roots = [];
    this.rootsActive = false;
    this.rootGroup.clear(true, true);
  }

  private handleHollowHartDefeated(): void {
    if (this.session.getFlag('hollow_hart_defeated') === true) {
      return;
    }

    this.clearRoots();
    this.session.setFlag('hollow_hart_defeated', true);
    this.session.addCinders(120);
    this.session.awardXp(160);
    this.session.advanceQuestObjective('main_hollow_hart', 'kill_hollow_hart', 1);
    this.session.log('The Hollow Hart collapses. Gloamwood falls silent.');
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
        this.persistRuntimeState();
        this.saveRepo.save(1, this.session.serialize());
        this.session.log('Rested and autosaved (slot 2).');
        break;
      case 'foundry':
        this.session.advanceQuestObjective('faction_foundry_trial', 'visit_foundry', 1);
        this.openFoundryPanel();
        break;
      case 'shop':
        this.openShopPanel();
        break;
      case 'savepoint':
        this.persistRuntimeState();
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

  private openShopPanel(): void {
    this.shopMessage = 'Foundry stock updated every few minutes.';
    this.registry.set(REGISTRY_KEYS.uiPanel, 'shop');
  }

  private openFoundryPanel(): void {
    this.foundryMessage = 'Temper weapons, reinforce armor, or craft supplies.';
    this.registry.set(REGISTRY_KEYS.uiPanel, 'foundry');
  }

  private onShopBuy(listingId: string): void {
    const result = this.shop.buy(listingId, this.session);

    if (result.ok) {
      const itemName = this.session.getItem(result.itemId)?.name ?? result.itemId;
      this.shopMessage = `Purchased ${itemName} for ${result.spentCinders} cinders.`;
      this.session.log(this.shopMessage);
      if (result.itemId === 'material_iron_ore') {
        this.session.advanceQuestObjective('faction_foundry_trial', 'collect_ore', 1);
      }
      return;
    }

    this.shopMessage = result.reason ?? 'Purchase failed.';
    this.session.log(this.shopMessage);
  }

  private onShopSell(itemId: string): void {
    const result = this.shop.sell(itemId, 1, this.session);

    if (result.ok) {
      const itemName = this.session.getItem(result.soldItemId)?.name ?? result.soldItemId;
      this.shopMessage = `Sold ${itemName} for ${result.earnedCinders} cinders.`;
      this.session.log(this.shopMessage);
      return;
    }

    this.shopMessage = result.reason ?? 'Sale failed.';
    this.session.log(this.shopMessage);
  }

  private onFoundryAction(actionId: string): void {
    if (actionId === 'upgrade_weapon' || actionId === 'upgrade_armor') {
      const target = actionId === 'upgrade_weapon' ? 'weapon' : 'armor';
      const result = this.upgrades.tryUpgrade(target, this.session);

      if (result.ok) {
        this.foundryMessage = `${target === 'weapon' ? 'Weapon' : 'Armor'} upgraded to +${result.nextLevel}.`;
        this.session.log(this.foundryMessage);
      } else {
        this.foundryMessage = result.reason ?? 'Upgrade failed.';
        this.session.log(this.foundryMessage);
      }

      this.session.advanceQuestObjective('faction_foundry_trial', 'visit_foundry', 1);
      return;
    }

    if (!actionId.startsWith('craft:')) {
      return;
    }

    const recipeId = actionId.replace('craft:', '');
    const recipe = this.crafting.listRecipes('foundry').find((entry) => entry.id === recipeId);
    if (!recipe) {
      this.foundryMessage = `Missing recipe: ${recipeId}`;
      this.session.log(this.foundryMessage);
      return;
    }

    const cindersBefore = this.session.getCinders();
    const crafted = this.crafting.craft(recipe.id, this.session.inventory, cindersBefore);

    if (!crafted.crafted) {
      this.foundryMessage = 'Insufficient materials or cinders.';
      this.session.log(this.foundryMessage);
      return;
    }

    const spent = cindersBefore - crafted.newCinders;
    if (spent > 0) {
      this.session.spendCinders(spent);
    }

    this.foundryMessage = `Crafted ${recipe.name}.`;
    this.session.log(this.foundryMessage);
    this.session.advanceQuestObjective('faction_foundry_trial', 'visit_foundry', 1);
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
    if (this.uiPanel !== '') {
      this.registry.set(REGISTRY_KEYS.interaction, this.uiPanel === 'dialogue' ? 'Dialogue active' : 'Menu open');
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

    if (x > 78 && y > 34) {
      region = 'sunken_spire';
    } else if (x > 70 && y < 20) {
      region = 'mirror_marsh';
    } else if (x > 52 && y >= 24) {
      region = 'salt_quarry';
    } else if (x > 52 && y < 24) {
      region = 'gloamwood';
    }

    if (region !== this.currentRegion) {
      this.currentRegion = region;
      this.session.discoverRegion(region);

      if (region === 'gloamwood') {
        this.session.advanceQuestObjective('main_hollow_hart', 'enter_gloamwood', 1);
      }
    }
  }

  private buildShopPanelState(): ShopPanelState {
    const listings = this.shop.listCatalog().map((listing) => ({
      id: listing.id,
      label: listing.displayName,
      price: listing.buyPrice,
      stock: listing.stock
    }));

    const sellableByItem = new Map<string, number>();
    for (const slot of this.session.getInventoryEntries()) {
      if (!slot.itemId || slot.amount <= 0) {
        continue;
      }

      if (!this.session.canSellItem(slot.itemId)) {
        continue;
      }

      sellableByItem.set(slot.itemId, (sellableByItem.get(slot.itemId) ?? 0) + slot.amount);
    }

    const sellable = [...sellableByItem.entries()]
      .map(([itemId, amount]) => ({
        itemId,
        label: this.session.getItem(itemId)?.name ?? itemId,
        amount,
        sellValue: Math.max(1, Math.floor(this.session.getItemValue(itemId) * 0.6))
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      title: 'Foundry Market',
      cinders: this.session.getCinders(),
      restockInSeconds: this.shop.getSecondsToRestock(),
      listings,
      sellable,
      message: this.shopMessage
    };
  }

  private buildFoundryPanelState(): FoundryPanelState {
    const upgrades = this.session.getEquipmentUpgrades();
    const anchorDust = this.session.countItem('key_anchor_dust');
    const cinders = this.session.getCinders();

    const options: FoundryPanelState['options'] = [];

    const weaponNext = upgrades.weapon + 1;
    const weaponCost = upgrades.weapon >= 5 ? { cinders: 0, anchorDust: 0 } : this.upgrades.getUpgradeCost('weapon', weaponNext);
    options.push({
      id: 'upgrade_weapon',
      label: upgrades.weapon >= 5 ? 'Temper Weapon (MAX)' : `Temper Weapon -> +${weaponNext}`,
      cinders: weaponCost.cinders,
      anchorDust: weaponCost.anchorDust,
      disabled: upgrades.weapon >= 5 || cinders < weaponCost.cinders || anchorDust < weaponCost.anchorDust
    });

    const armorNext = upgrades.armor + 1;
    const armorCost = upgrades.armor >= 5 ? { cinders: 0, anchorDust: 0 } : this.upgrades.getUpgradeCost('armor', armorNext);
    options.push({
      id: 'upgrade_armor',
      label: upgrades.armor >= 5 ? 'Reinforce Armor (MAX)' : `Reinforce Armor -> +${armorNext}`,
      cinders: armorCost.cinders,
      anchorDust: armorCost.anchorDust,
      disabled: upgrades.armor >= 5 || cinders < armorCost.cinders || anchorDust < armorCost.anchorDust
    });

    for (const recipe of this.crafting.listRecipes('foundry')) {
      options.push({
        id: `craft:${recipe.id}`,
        label: `Craft ${recipe.name}`,
        cinders: recipe.cindersCost,
        anchorDust: 0,
        disabled: !this.crafting.canCraft(recipe.id, this.session.inventory, this.session.getCinders())
      });
    }

    return {
      cinders,
      anchorDust,
      weaponLevel: upgrades.weapon,
      armorLevel: upgrades.armor,
      options,
      message: this.foundryMessage
    };
  }

  private persistRuntimeState(): void {
    this.session.setShopRuntimeState(this.shop.serialize());
  }

  private publishUiState(): void {
    this.registry.set(REGISTRY_KEYS.hud, this.session.getHudViewModel());

    this.registry.set(REGISTRY_KEYS.inventory, {
      entries: this.session.getInventoryEntries(),
      activeTab: this.inventoryTab,
      cinders: this.session.getCinders(),
      equipment: this.session.getEquipment()
    });

    this.registry.set(REGISTRY_KEYS.shop, this.buildShopPanelState());
    this.registry.set(REGISTRY_KEYS.foundry, this.buildFoundryPanelState());

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
