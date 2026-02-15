import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  public constructor() {
    super('boot');
  }

  public create(): void {
    this.createTileTexture('tile-ground', 0x3c4638, 0x2d3429);
    this.createTileTexture('tile-wall', 0x5b5045, 0x473d34);
    this.createTileTexture('tile-water', 0x2f4a66, 0x243a52);
    this.createTileTexture('tile-marsh', 0x374535, 0x2d3b2b);
    this.createTileTexture('tile-path', 0x665847, 0x544839);

    this.createEntityTexture('player', 0xd8dcc8, 0x273033);
    this.createEntityTexture('npc-archivist', 0x9bc2c8, 0x31434a);
    this.createEntityTexture('npc-rook', 0xcbb37f, 0x574426);
    this.createEntityTexture('npc-pilgrim', 0xa78b99, 0x443344);

    this.createEntityTexture('chest', 0xc69a55, 0x594127);
    this.createEntityTexture('campfire', 0xc86e35, 0x4f2f1b);
    this.createEntityTexture('foundry', 0xa7a39a, 0x46433d);
    this.createEntityTexture('savepoint', 0x8ab2c9, 0x2f4451);

    this.createEntityTexture('enemy-siltling', 0x8b7766, 0x3f3026);
    this.createEntityTexture('enemy-grove_stalker', 0x6f8c69, 0x2a3828);
    this.createEntityTexture('enemy-quarry_brute', 0x9d7e68, 0x4f372d);

    this.createProjectileTexture('arrow', 0xd4d2ca, 0x6e6657);
    this.createSlashTexture('slash-light', 0xeecf87, 0.65);
    this.createSlashTexture('slash-heavy', 0xe8a066, 0.72);

    this.scene.start('main-menu');
  }

  private createTileTexture(key: string, fillColor: number, borderColor: number): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(fillColor, 1);
    gfx.fillRect(0, 0, 32, 32);

    gfx.lineStyle(1, borderColor, 0.55);
    for (let i = 0; i < 3; i += 1) {
      const x = Phaser.Math.Between(2, 22);
      const y = Phaser.Math.Between(2, 22);
      gfx.strokeRect(x, y, Phaser.Math.Between(6, 10), Phaser.Math.Between(5, 9));
    }

    gfx.generateTexture(key, 32, 32);
    gfx.destroy();
  }

  private createEntityTexture(key: string, fillColor: number, borderColor: number): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(fillColor, 1);
    gfx.fillRoundedRect(0, 0, 32, 32, 4);
    gfx.lineStyle(2, borderColor, 0.95);
    gfx.strokeRoundedRect(1, 1, 30, 30, 4);

    gfx.fillStyle(borderColor, 0.5);
    gfx.fillRect(8, 8, 16, 3);

    gfx.generateTexture(key, 32, 32);
    gfx.destroy();
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
