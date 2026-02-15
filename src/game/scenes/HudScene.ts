import Phaser from 'phaser';
import type { HudViewModel } from '../state/types';
import { REGISTRY_KEYS, type UiPanel } from '../ui/registryKeys';

const DEFAULT_SNAPSHOT: HudViewModel = {
  hp: 100,
  maxHp: 100,
  stamina: 100,
  maxStamina: 100,
  level: 1,
  xp: 0,
  xpToNext: 100,
  cinders: 0,
  activeWeaponMode: 'sword',
  questHint: 'Main: Speak with the Archivist in Cinderhaven.',
  events: [],
  quickbar: ['1: --', '2: --', '3: --', '4: --', '5: --', '6: --', '7: --', '8: --']
};

export class HudScene extends Phaser.Scene {
  private topLine!: Phaser.GameObjects.Text;
  private questLine!: Phaser.GameObjects.Text;
  private interactionLine!: Phaser.GameObjects.Text;
  private eventLines: Phaser.GameObjects.Text[] = [];
  private quickbarLine!: Phaser.GameObjects.Text;
  private overlayShade!: Phaser.GameObjects.Rectangle;

  private readonly onHudChanged = (_parent: unknown, value: HudViewModel): void => {
    this.renderHud(value);
  };
  private readonly onInteractionChanged = (_parent: unknown, value: string): void => {
    this.interactionLine.setText(value);
  };
  private readonly onPanelChanged = (_parent: unknown, panel: UiPanel): void => {
    this.overlayShade.setVisible(panel !== '' && panel !== 'dialogue');
  };

  public constructor() {
    super('hud');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    this.overlayShade = this.add
      .rectangle(640, 360, 1280, 720, 0x000000, 0.35)
      .setScrollFactor(0)
      .setDepth(19)
      .setVisible(false);

    this.add.rectangle(640, 32, 1260, 58, 0x080807, 0.82).setScrollFactor(0).setDepth(20);
    this.add.rectangle(640, 690, 1260, 52, 0x080807, 0.84).setScrollFactor(0).setDepth(20);
    this.add.rectangle(250, 614, 470, 170, 0x080807, 0.74).setScrollFactor(0).setDepth(20);

    this.topLine = this.add
      .text(24, 14, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ece8ce'
      })
      .setScrollFactor(0)
      .setDepth(21);

    this.questLine = this.add
      .text(24, 40, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#c3cba8'
      })
      .setScrollFactor(0)
      .setDepth(21);

    this.quickbarLine = this.add
      .text(24, 674, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#d9d3ba'
      })
      .setScrollFactor(0)
      .setDepth(21);

    this.interactionLine = this.add
      .text(24, 646, '', {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#f2d67e'
      })
      .setScrollFactor(0)
      .setDepth(21);

    for (let i = 0; i < 7; i += 1) {
      const line = this.add
        .text(24, 546 + i * 18, '', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#d6d2b7'
        })
        .setScrollFactor(0)
        .setDepth(21);
      this.eventLines.push(line);
    }

    this.renderHud((this.registry.get(REGISTRY_KEYS.hud) as HudViewModel | undefined) ?? DEFAULT_SNAPSHOT);

    this.registry.events.on(`changedata-${REGISTRY_KEYS.hud}`, this.onHudChanged);
    this.registry.events.on(`changedata-${REGISTRY_KEYS.interaction}`, this.onInteractionChanged);
    this.registry.events.on(`changedata-${REGISTRY_KEYS.uiPanel}`, this.onPanelChanged);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(`changedata-${REGISTRY_KEYS.hud}`, this.onHudChanged);
      this.registry.events.off(`changedata-${REGISTRY_KEYS.interaction}`, this.onInteractionChanged);
      this.registry.events.off(`changedata-${REGISTRY_KEYS.uiPanel}`, this.onPanelChanged);
    });
  }

  private renderHud(snapshot: HudViewModel): void {
    this.topLine.setText(
      `HP ${snapshot.hp}/${snapshot.maxHp}  ST ${snapshot.stamina}/${snapshot.maxStamina}  LVL ${snapshot.level}  XP ${snapshot.xp}/${snapshot.xpToNext}  Cinders ${snapshot.cinders}  Weapon ${snapshot.activeWeaponMode.toUpperCase()}`
    );
    this.questLine.setText(`Quest: ${snapshot.questHint}`);
    this.quickbarLine.setText(snapshot.quickbar.join('    '));

    for (let i = 0; i < this.eventLines.length; i += 1) {
      this.eventLines[i].setText(snapshot.events[i] ?? '');
    }
  }
}
