import Phaser from 'phaser';

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

const DEFAULT_SNAPSHOT: HudSnapshot = {
  hp: 100,
  maxHp: 100,
  stamina: 100,
  maxStamina: 100,
  level: 1,
  cinders: 0,
  questHint: 'Main: Speak with the Archivist in Cinderhaven.',
  events: []
};

export class HudScene extends Phaser.Scene {
  private topLine!: Phaser.GameObjects.Text;
  private questLine!: Phaser.GameObjects.Text;
  private interactionLine!: Phaser.GameObjects.Text;
  private eventLines: Phaser.GameObjects.Text[] = [];
  private readonly onHudChanged = (_parent: unknown, value: HudSnapshot): void => {
    this.renderHud(value);
  };
  private readonly onInteractionChanged = (_parent: unknown, value: string): void => {
    this.interactionLine.setText(value);
  };

  public constructor() {
    super('hud');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    this.add.rectangle(640, 32, 1260, 56, 0x080807, 0.78).setScrollFactor(0).setDepth(20);
    this.add.rectangle(240, 640, 460, 138, 0x080807, 0.74).setScrollFactor(0).setDepth(20);

    this.topLine = this.add
      .text(24, 16, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ece8ce'
      })
      .setScrollFactor(0)
      .setDepth(21);

    this.questLine = this.add
      .text(24, 44, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#c3cba8'
      })
      .setScrollFactor(0)
      .setDepth(21);

    this.interactionLine = this.add
      .text(24, 678, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#f2d67e'
      })
      .setScrollFactor(0)
      .setDepth(21);

    for (let i = 0; i < 5; i += 1) {
      const line = this.add
        .text(24, 572 + i * 20, '', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#d6d2b7'
        })
        .setScrollFactor(0)
        .setDepth(21);
      this.eventLines.push(line);
    }

    this.renderHud((this.registry.get('hud') as HudSnapshot | undefined) ?? DEFAULT_SNAPSHOT);

    this.registry.events.on('changedata-hud', this.onHudChanged);
    this.registry.events.on('changedata-showInteraction', this.onInteractionChanged);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-hud', this.onHudChanged);
      this.registry.events.off('changedata-showInteraction', this.onInteractionChanged);
    });
  }

  private renderHud(snapshot: HudSnapshot): void {
    this.topLine.setText(
      `HP ${snapshot.hp}/${snapshot.maxHp}   ST ${snapshot.stamina}/${snapshot.maxStamina}   LVL ${snapshot.level}   Cinders ${snapshot.cinders}`
    );
    this.questLine.setText(snapshot.questHint);

    for (let i = 0; i < this.eventLines.length; i += 1) {
      this.eventLines[i].setText(snapshot.events[i] ?? '');
    }
  }
}
