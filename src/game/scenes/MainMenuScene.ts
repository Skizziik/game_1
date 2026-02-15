import Phaser from 'phaser';
import { SaveRepository } from '../systems/save/SaveRepository';
import { REGISTRY_KEYS } from '../ui/registryKeys';

const OPTIONS = ['Continue', 'New Game', 'Settings', 'Credits'] as const;

type MenuOption = (typeof OPTIONS)[number];

export class MainMenuScene extends Phaser.Scene {
  private selected = 0;
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private hasSave = false;
  private readonly saveRepo = new SaveRepository();

  public constructor() {
    super('main-menu');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#0a1218');

    const gradient = this.add.graphics();
    gradient.fillGradientStyle(0x24343f, 0x1b2934, 0x111819, 0x0b0d10, 1, 1, 1, 1);
    gradient.fillRect(0, 0, 1280, 720);
    gradient.setDepth(-5);

    this.add
      .text(640, 130, 'ASH & AETHER', {
        fontFamily: 'monospace',
        fontSize: '72px',
        color: '#efe4c0'
      })
      .setOrigin(0.5);

    this.add
      .text(640, 196, 'Post-Fantasy Ruin Warden RPG', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#b2c0b7'
      })
      .setOrigin(0.5);

    this.hasSave = this.saveRepo.listSlots().some((entry) => entry.exists);

    OPTIONS.forEach((option, index) => {
      const text = this.add
        .text(640, 300 + index * 52, option, {
          fontFamily: 'monospace',
          fontSize: '36px',
          color: '#b8aa86'
        })
        .setOrigin(0.5);
      this.optionTexts.push(text);
    });

    this.add
      .text(640, 660, 'Arrows/WASD: Navigate  Enter/Space: Select', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#8e8e85'
      })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown-UP', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-W', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-S', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.selectCurrent());
    this.input.keyboard?.on('keydown-SPACE', () => this.selectCurrent());

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.optionTexts.forEach((text, index) => {
        if (text.getBounds().contains(pointer.x, pointer.y)) {
          this.selected = index;
          this.renderSelection();
        }
      });
    });

    this.input.on('pointerdown', () => this.selectCurrent());

    this.renderSelection();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
      this.input.removeAllListeners();
    });
  }

  private moveSelection(delta: number): void {
    this.selected = Phaser.Math.Wrap(this.selected + delta, 0, OPTIONS.length);
    this.renderSelection();
  }

  private renderSelection(): void {
    this.optionTexts.forEach((text, index) => {
      const option = OPTIONS[index];
      const disabled = option === 'Continue' && !this.hasSave;
      const selected = index === this.selected;

      text.setColor(disabled ? '#64615b' : selected ? '#f3db95' : '#b8aa86');
      text.setScale(selected ? 1.08 : 1);
      text.setText(disabled ? `${option} (No Save)` : option);
    });
  }

  private selectCurrent(): void {
    const option = OPTIONS[this.selected] as MenuOption;

    if (option === 'Continue') {
      if (!this.hasSave) {
        this.registry.set(REGISTRY_KEYS.notification, 'No save file found.');
        return;
      }

      this.registry.set('bootMode', 'continue');
      this.scene.start('overworld');
      return;
    }

    if (option === 'New Game') {
      this.registry.set('bootMode', 'new');
      this.scene.start('overworld');
      return;
    }

    if (option === 'Settings') {
      this.scene.start('settings-menu', { from: 'menu' });
      return;
    }

    if (option === 'Credits') {
      this.scene.start('credits', { from: 'menu' });
    }
  }
}
