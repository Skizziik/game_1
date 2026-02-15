import Phaser from 'phaser';
import { REGISTRY_KEYS } from '../ui/registryKeys';

interface SettingsState {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  fontScale: 'normal' | 'large';
}

const DEFAULT_SETTINGS: SettingsState = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  screenShake: true,
  fontScale: 'normal'
};

const ORDER: Array<keyof SettingsState> = ['masterVolume', 'musicVolume', 'sfxVolume', 'screenShake', 'fontScale'];

export class SettingsMenuScene extends Phaser.Scene {
  private state: SettingsState = { ...DEFAULT_SETTINGS };
  private from: 'menu' | 'game' = 'menu';
  private selected = 0;
  private lineTexts: Phaser.GameObjects.Text[] = [];

  public constructor() {
    super('settings-menu');
  }

  public init(data: { from?: 'menu' | 'game' }): void {
    this.from = data.from ?? 'menu';
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#111417');

    const stored = this.registry.get(REGISTRY_KEYS.settings) as SettingsState | undefined;
    this.state = stored ? { ...stored } : { ...DEFAULT_SETTINGS };

    this.add
      .text(640, 100, 'SETTINGS', {
        fontFamily: 'monospace',
        fontSize: '52px',
        color: '#f0e6bf'
      })
      .setOrigin(0.5);

    const labels = [
      () => `Master Volume: ${Math.round(this.state.masterVolume * 100)}%`,
      () => `Music Volume: ${Math.round(this.state.musicVolume * 100)}%`,
      () => `SFX Volume: ${Math.round(this.state.sfxVolume * 100)}%`,
      () => `Screen Shake: ${this.state.screenShake ? 'ON' : 'OFF'}`,
      () => `Font Size: ${this.state.fontScale === 'normal' ? 'Normal' : 'Large'}`
    ];

    labels.forEach((getLine, index) => {
      const text = this.add
        .text(640, 220 + index * 70, getLine(), {
          fontFamily: 'monospace',
          fontSize: '30px',
          color: '#b9b09b'
        })
        .setOrigin(0.5);
      this.lineTexts.push(text);
    });

    this.add
      .text(640, 650, 'Left/Right: Change  Up/Down: Navigate  Enter/Esc: Back', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#8a8a83'
      })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown-UP', () => this.move(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard?.on('keydown-LEFT', () => this.adjust(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.adjust(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.goBack());
    this.input.keyboard?.on('keydown-ESC', () => this.goBack());

    this.render();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
    });
  }

  private move(delta: number): void {
    this.selected = Phaser.Math.Wrap(this.selected + delta, 0, ORDER.length);
    this.render();
  }

  private adjust(direction: -1 | 1): void {
    const key = ORDER[this.selected];

    if (key === 'screenShake') {
      this.state.screenShake = direction > 0;
    } else if (key === 'fontScale') {
      this.state.fontScale = direction > 0 ? 'large' : 'normal';
    } else {
      const current = this.state[key] as number;
      const delta = key === 'masterVolume' ? 0.1 : 0.05;
      this.state[key] = Phaser.Math.Clamp(current + direction * delta, 0, 1) as never;
    }

    this.registry.set(REGISTRY_KEYS.settings, { ...this.state });
    this.render();
  }

  private render(): void {
    const lines = [
      `Master Volume: ${Math.round(this.state.masterVolume * 100)}%`,
      `Music Volume: ${Math.round(this.state.musicVolume * 100)}%`,
      `SFX Volume: ${Math.round(this.state.sfxVolume * 100)}%`,
      `Screen Shake: ${this.state.screenShake ? 'ON' : 'OFF'}`,
      `Font Size: ${this.state.fontScale === 'normal' ? 'Normal' : 'Large'}`
    ];

    this.lineTexts.forEach((text, index) => {
      text.setText(lines[index]);
      text.setColor(index === this.selected ? '#f2d692' : '#b9b09b');
      text.setScale(index === this.selected ? 1.06 : 1);
    });
  }

  private goBack(): void {
    if (this.from === 'game') {
      this.scene.stop();
      this.scene.resume('overworld');
      this.registry.set(REGISTRY_KEYS.uiPanel, '');
      return;
    }

    this.scene.start('main-menu');
  }
}
