import Phaser from 'phaser';
import { REGISTRY_KEYS, type UiPanel } from '../ui/registryKeys';
import { UI_THEME } from '../ui/theme';

interface CharacterState {
  stats: Record<string, number>;
  perkPoints: number;
  perks: Array<{
    id: string;
    branch: string;
    name: string;
    description: string;
    rank: number;
    maxRank: number;
  }>;
  reputations: Record<string, number>;
}

const DEFAULT_STATE: CharacterState = {
  stats: {},
  perkPoints: 0,
  perks: [],
  reputations: {}
};

export class CharacterScene extends Phaser.Scene {
  private panel!: Phaser.GameObjects.Container;
  private state = DEFAULT_STATE;
  private statsText!: Phaser.GameObjects.Text;
  private perksText!: Phaser.GameObjects.Text;
  private repText!: Phaser.GameObjects.Text;

  public constructor() {
    super('character-ui');
  }

  public create(): void {
    this.panel = this.add.container(0, 0).setDepth(200).setVisible(false);

    const bg = this.add.rectangle(640, 360, 1120, 620, UI_THEME.panelFill, UI_THEME.panelAlpha);
    bg.setStrokeStyle(2, UI_THEME.panelStroke);
    this.panel.add(bg);

    this.panel.add(
      this.add.text(100, 72, 'Character & Perks', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: UI_THEME.titleColor
      })
    );

    this.statsText = this.add.text(100, 130, '', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: UI_THEME.textColor,
      lineSpacing: 6
    });
    this.panel.add(this.statsText);

    this.perksText = this.add.text(470, 130, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#d9d0b8',
      lineSpacing: 4,
      wordWrap: { width: 540 }
    });
    this.panel.add(this.perksText);

    this.repText = this.add.text(100, 480, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#bab19b',
      lineSpacing: 6
    });
    this.panel.add(this.repText);

    this.registry.events.on('changedata-uiPanel', this.onPanelChange, this);
    this.registry.events.on('changedata-characterState', this.onStateChange, this);

    this.input.keyboard?.on('keydown-C', () => this.closeIfOpen());
    this.input.keyboard?.on('keydown-P', () => this.closeIfOpen());
    this.input.keyboard?.on('keydown-ESC', () => this.closeIfOpen());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-uiPanel', this.onPanelChange, this);
      this.registry.events.off('changedata-characterState', this.onStateChange, this);
      this.input.keyboard?.removeAllListeners();
    });
  }

  private onPanelChange(_parent: unknown, panel: UiPanel): void {
    this.panel.setVisible(panel === 'character');
  }

  private onStateChange(_parent: unknown, state: CharacterState): void {
    this.state = state;
    this.render();
  }

  private render(): void {
    const stats = this.state.stats;
    this.statsText.setText(
      [
        `Level: ${stats.level ?? 1}`,
        `HP: ${stats.hp ?? 0}/${stats.maxHp ?? 0}`,
        `Stamina: ${stats.stamina ?? 0}/${stats.maxStamina ?? 0}`,
        `Attack: ${stats.attack ?? 0}`,
        `Defense: ${stats.defense ?? 0}`,
        `Crit: ${Math.round((stats.crit ?? 0) * 100)}%`,
        `Move Speed: ${stats.moveSpeed ?? 0}`,
        `Perk Points: ${this.state.perkPoints}`
      ].join('\n')
    );

    const perkLines = this.state.perks.map((perk) => `${perk.branch} | ${perk.name} ${perk.rank}/${perk.maxRank} - ${perk.description}`);
    this.perksText.setText(['Perk Tree', ...perkLines].join('\n'));

    this.repText.setText(
      ['Faction Reputation', ...Object.entries(this.state.reputations).map(([key, value]) => `${key}: ${value}`)].join('\n')
    );
  }

  private closeIfOpen(): void {
    if (!this.panel.visible) {
      return;
    }
    this.registry.set(REGISTRY_KEYS.uiPanel, '');
  }
}
