import Phaser from 'phaser';
import { REGISTRY_KEYS, type UiPanel } from '../ui/registryKeys';
import { UI_THEME } from '../ui/theme';

interface FoundryOption {
  id: string;
  label: string;
  cinders: number;
  anchorDust: number;
  disabled?: boolean;
}

interface FoundryState {
  cinders: number;
  anchorDust: number;
  weaponLevel: number;
  armorLevel: number;
  options: FoundryOption[];
  message?: string;
}

const DEFAULT_STATE: FoundryState = {
  cinders: 0,
  anchorDust: 0,
  weaponLevel: 0,
  armorLevel: 0,
  options: []
};

export class FoundryScene extends Phaser.Scene {
  private panel!: Phaser.GameObjects.Container;
  private headerText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private optionLines: Phaser.GameObjects.Text[] = [];
  private messageText!: Phaser.GameObjects.Text;

  private state: FoundryState = DEFAULT_STATE;
  private selected = 0;

  public constructor() {
    super('foundry-ui');
  }

  public create(): void {
    this.panel = this.add.container(0, 0).setDepth(220).setVisible(false);

    const bg = this.add.rectangle(640, 360, 980, 540, UI_THEME.panelFill, UI_THEME.panelAlpha);
    bg.setStrokeStyle(2, UI_THEME.panelStroke);
    this.panel.add(bg);

    this.headerText = this.add.text(168, 120, 'Foundry Bench', {
      fontFamily: 'monospace',
      fontSize: '34px',
      color: UI_THEME.titleColor
    });
    this.panel.add(this.headerText);

    this.levelText = this.add.text(168, 168, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#c6bea4'
    });
    this.panel.add(this.levelText);

    for (let i = 0; i < 8; i += 1) {
      const line = this.add.text(168, 222 + i * 34, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#d8d1bb'
      });
      this.optionLines.push(line);
      this.panel.add(line);
    }

    this.messageText = this.add.text(168, 478, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#aaa88f'
    });
    this.panel.add(this.messageText);

    this.panel.add(
      this.add.text(168, 506, 'Up/Down: Select  Enter: Execute  Esc: Close', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#8f886f'
      })
    );

    this.registry.events.on(`changedata-${REGISTRY_KEYS.uiPanel}`, this.onPanelChange, this);
    this.registry.events.on(`changedata-${REGISTRY_KEYS.foundry}`, this.onFoundryState, this);

    this.input.keyboard?.on('keydown-UP', () => this.move(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard?.on('keydown-W', () => this.move(-1));
    this.input.keyboard?.on('keydown-S', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', this.confirm, this);
    this.input.keyboard?.on('keydown-SPACE', this.confirm, this);
    this.input.keyboard?.on('keydown-ESC', this.close, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(`changedata-${REGISTRY_KEYS.uiPanel}`, this.onPanelChange, this);
      this.registry.events.off(`changedata-${REGISTRY_KEYS.foundry}`, this.onFoundryState, this);
      this.input.keyboard?.removeAllListeners();
    });
  }

  private onPanelChange(_parent: unknown, panel: UiPanel): void {
    const visible = panel === 'foundry';
    this.panel.setVisible(visible);
    if (visible) {
      this.render();
    }
  }

  private onFoundryState(_parent: unknown, state: FoundryState): void {
    this.state = state;
    this.selected = Phaser.Math.Clamp(this.selected, 0, Math.max(0, state.options.length - 1));
    this.render();
  }

  private move(delta: number): void {
    if (!this.panel.visible || this.state.options.length === 0) {
      return;
    }

    this.selected = Phaser.Math.Wrap(this.selected + delta, 0, this.state.options.length);
    this.render();
  }

  private confirm(): void {
    if (!this.panel.visible) {
      return;
    }

    const option = this.state.options[this.selected];
    if (!option || option.disabled) {
      return;
    }

    this.game.events.emit('foundry:action', option.id);
  }

  private close(): void {
    if (!this.panel.visible) {
      return;
    }

    this.registry.set(REGISTRY_KEYS.uiPanel, '');
  }

  private render(): void {
    this.headerText.setText(`Foundry Bench   Cinders: ${this.state.cinders}   Anchor Dust: ${this.state.anchorDust}`);
    this.levelText.setText(`Weapon +${this.state.weaponLevel}   Armor +${this.state.armorLevel}`);

    this.optionLines.forEach((line, index) => {
      const option = this.state.options[index];
      if (!option) {
        line.setText('');
        return;
      }

      const selected = index === this.selected;
      line.setText(
        `${selected ? '>' : ' '} ${option.label}  (${option.cinders}c, ${option.anchorDust} dust)`
      );
      line.setColor(option.disabled ? '#7e7766' : selected ? '#f1d391' : '#d8d1bb');
    });

    this.messageText.setText(this.state.message ?? 'Refine gear, craft supplies, and push deeper into ruins.');
  }
}
