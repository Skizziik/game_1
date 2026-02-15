import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  public constructor() {
    super('boot');
  }

  public create(): void {
    this.createTileTexture('tile-ground', 0x334333, 0x2b372b);
    this.createTileTexture('tile-wall', 0x5a4f41, 0x493f33);
    this.createTileTexture('tile-water', 0x2f4e6c, 0x263f59);
    this.createEntityTexture('player', 0xd8dcc8, 0x273033);
    this.createEntityTexture('chest', 0xc69a55, 0x594127);
    this.createEntityTexture('campfire', 0xc86e35, 0x4f2f1b);

    this.scene.start('overworld');
    this.scene.launch('hud');
  }

  private createTileTexture(key: string, fillColor: number, borderColor: number): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(fillColor, 1);
    gfx.fillRect(0, 0, 32, 32);
    gfx.lineStyle(2, borderColor, 0.5);
    gfx.strokeRect(1, 1, 30, 30);
    gfx.generateTexture(key, 32, 32);
    gfx.destroy();
  }

  private createEntityTexture(key: string, fillColor: number, borderColor: number): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(fillColor, 1);
    gfx.fillRoundedRect(0, 0, 32, 32, 4);
    gfx.lineStyle(2, borderColor, 0.9);
    gfx.strokeRoundedRect(1, 1, 30, 30, 4);
    gfx.generateTexture(key, 32, 32);
    gfx.destroy();
  }
}
