import Phaser from 'phaser';

const KENNEY_SHEET = 'sheet-kenney';
const CREATURE_SHEET = 'sheet-creatures';

const KENNEY_FRAMES = {
  ground: 24,
  wall: 8,
  water: 36,
  marsh: 37,
  path: 25,
  player: 61,
  npcArchivist: 60,
  npcRook: 62,
  npcPilgrim: 63,
  chest: 2,
  campfire: 14,
  foundry: 40,
  savepoint: 30
} as const;

const CREATURE_FRAMES = {
  siltling: 98,
  groveStalker: 123,
  quarryBrute: 171
} as const;

export class BootScene extends Phaser.Scene {
  public constructor() {
    super('boot');
  }

  public preload(): void {
    this.load.spritesheet(KENNEY_SHEET, '/assets/cc0/kenney/tilemap_packed.png', {
      frameWidth: 16,
      frameHeight: 16
    });

    this.load.spritesheet(CREATURE_SHEET, '/assets/cc0/creatures/tilemap_packed.png', {
      frameWidth: 16,
      frameHeight: 16
    });
  }

  public create(): void {
    this.createTextureFromFrame('tile-ground', KENNEY_SHEET, KENNEY_FRAMES.ground);
    this.createTextureFromFrame('tile-wall', KENNEY_SHEET, KENNEY_FRAMES.wall);
    this.createTextureFromFrame('tile-water', KENNEY_SHEET, KENNEY_FRAMES.water);
    this.createTextureFromFrame('tile-marsh', KENNEY_SHEET, KENNEY_FRAMES.marsh);
    this.createTextureFromFrame('tile-path', KENNEY_SHEET, KENNEY_FRAMES.path);

    this.createTextureFromFrame('player', KENNEY_SHEET, KENNEY_FRAMES.player);
    this.createTextureFromFrame('npc-archivist', KENNEY_SHEET, KENNEY_FRAMES.npcArchivist);
    this.createTextureFromFrame('npc-rook', KENNEY_SHEET, KENNEY_FRAMES.npcRook);
    this.createTextureFromFrame('npc-pilgrim', KENNEY_SHEET, KENNEY_FRAMES.npcPilgrim);

    this.createTextureFromFrame('chest', KENNEY_SHEET, KENNEY_FRAMES.chest);
    this.createTextureFromFrame('campfire', KENNEY_SHEET, KENNEY_FRAMES.campfire);
    this.createTextureFromFrame('foundry', KENNEY_SHEET, KENNEY_FRAMES.foundry);
    this.createTextureFromFrame('savepoint', KENNEY_SHEET, KENNEY_FRAMES.savepoint);

    this.createTextureFromFrame('enemy-siltling', CREATURE_SHEET, CREATURE_FRAMES.siltling);
    this.createTextureFromFrame('enemy-grove_stalker', CREATURE_SHEET, CREATURE_FRAMES.groveStalker);
    this.createTextureFromFrame('enemy-quarry_brute', CREATURE_SHEET, CREATURE_FRAMES.quarryBrute);

    this.createProjectileTexture('arrow', 0xd4d2ca, 0x6e6657);
    this.createSlashTexture('slash-light', 0xeecf87, 0.65);
    this.createSlashTexture('slash-heavy', 0xe8a066, 0.72);

    this.scene.start('main-menu');
  }

  private createTextureFromFrame(key: string, sourceSheet: string, frame: number): void {
    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }

    const canvas = this.textures.createCanvas(key, 16, 16);
    if (!canvas) {
      throw new Error(`Failed to create texture canvas for ${key}`);
    }
    canvas.clear();
    canvas.drawFrame(sourceSheet, frame, 0, 0);
    canvas.refresh();
  }

  private createProjectileTexture(key: string, fillColor: number, borderColor: number): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(fillColor, 1);
    gfx.fillRect(0, 5, 18, 2);
    gfx.fillStyle(borderColor, 1);
    gfx.fillTriangle(18, 3, 26, 6, 18, 9);
    gfx.generateTexture(key, 26, 12);
    gfx.destroy();
  }

  private createSlashTexture(key: string, color: number, alpha: number): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(color, alpha);
    gfx.slice(20, 20, 18, Phaser.Math.DegToRad(225), Phaser.Math.DegToRad(340), false);
    gfx.fillPath();
    gfx.generateTexture(key, 40, 40);
    gfx.destroy();
  }
}
