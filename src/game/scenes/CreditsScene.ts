import Phaser from 'phaser';

export class CreditsScene extends Phaser.Scene {
  private from: 'menu' | 'game' = 'menu';

  public constructor() {
    super('credits');
  }

  public init(data: { from?: 'menu' | 'game' }): void {
    this.from = data.from ?? 'menu';
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#0b0d10');

    this.add
      .text(640, 90, 'CREDITS', {
        fontFamily: 'monospace',
        fontSize: '50px',
        color: '#eee0b8'
      })
      .setOrigin(0.5);

    const lines = [
      'Ash & Aether - Working Title',
      '',
      'Design Direction: Post-fantasy ruins, memory-loss mythos',
      'Gameplay Foundation: TypeScript + Phaser 3',
      'Systems: Combat, quests, dialogue, inventory, save migration',
      '',
      'Factions:',
      '- The Archivists',
      '- Pilgrims of Silt',
      '- Foundry Guild',
      '',
      'Press Esc or Enter to return'
    ];

    this.add
      .text(640, 220, lines.join('\n'), {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#c7c2a8',
        align: 'center',
        lineSpacing: 8
      })
      .setOrigin(0.5, 0);

    this.input.keyboard?.once('keydown-ESC', () => this.goBack());
    this.input.keyboard?.once('keydown-ENTER', () => this.goBack());
  }

  private goBack(): void {
    if (this.from === 'game') {
      this.scene.stop();
      this.scene.resume('overworld');
      return;
    }

    this.scene.start('main-menu');
  }
}
