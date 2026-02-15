import Phaser from 'phaser';
import { REGISTRY_KEYS, type UiPanel } from '../ui/registryKeys';
import { UI_THEME } from '../ui/theme';

interface DialogueChoice {
  id: string;
  text: string;
}

interface DialogueState {
  speakerId: string;
  text: string;
  choices: DialogueChoice[];
  portrait?: string;
}

export class DialogueScene extends Phaser.Scene {
  private panel!: Phaser.GameObjects.Container;
  private speakerText!: Phaser.GameObjects.Text;
  private lineText!: Phaser.GameObjects.Text;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private state: DialogueState = { speakerId: '', text: '', choices: [] };
  private selected = 0;

  public constructor() {
    super('dialogue-ui');
  }

  public create(): void {
    this.panel = this.add.container(0, 0).setDepth(240).setVisible(false);

    const bg = this.add.rectangle(640, 588, 1200, 236, UI_THEME.panelFill, 0.92);
    bg.setStrokeStyle(2, UI_THEME.panelStroke);
    this.panel.add(bg);

    this.speakerText = this.add.text(80, 482, '', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: UI_THEME.accentColor
    });
    this.panel.add(this.speakerText);

    this.lineText = this.add.text(80, 520, '', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: UI_THEME.textColor,
      wordWrap: { width: 1140 }
    });
    this.panel.add(this.lineText);

    for (let i = 0; i < 5; i += 1) {
      const choiceText = this.add.text(92, 590 + i * 28, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#b8b09c',
        wordWrap: { width: 1120 }
      });
      this.choiceTexts.push(choiceText);
      this.panel.add(choiceText);
    }

    this.registry.events.on('changedata-uiPanel', this.onPanelChange, this);
    this.registry.events.on('changedata-dialogueState', this.onDialogueState, this);

    this.input.keyboard?.on('keydown-UP', () => this.move(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard?.on('keydown-W', () => this.move(-1));
    this.input.keyboard?.on('keydown-S', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard?.on('keydown-SPACE', () => this.confirm());
    this.input.keyboard?.on('keydown-ESC', () => this.cancel());

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.panel.visible) {
        return;
      }

      this.choiceTexts.forEach((text, index) => {
        if (text.getBounds().contains(pointer.x, pointer.y) && this.state.choices[index]) {
          this.selected = index;
          this.confirm();
        }
      });
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-uiPanel', this.onPanelChange, this);
      this.registry.events.off('changedata-dialogueState', this.onDialogueState, this);
      this.input.keyboard?.removeAllListeners();
      this.input.removeAllListeners();
    });
  }

  private onPanelChange(_parent: unknown, panel: UiPanel): void {
    this.panel.setVisible(panel === 'dialogue');
    if (panel !== 'dialogue') {
      this.selected = 0;
    }
    this.renderChoices();
  }

  private onDialogueState(_parent: unknown, state: DialogueState): void {
    this.state = state;
    this.selected = 0;
    this.speakerText.setText(state.speakerId);
    this.lineText.setText(state.text);
    this.renderChoices();
  }

  private move(delta: number): void {
    if (!this.panel.visible || this.state.choices.length === 0) {
      return;
    }

    this.selected = Phaser.Math.Wrap(this.selected + delta, 0, this.state.choices.length);
    this.renderChoices();
  }

  private renderChoices(): void {
    this.choiceTexts.forEach((text, index) => {
      const choice = this.state.choices[index];
      if (!choice || !this.panel.visible) {
        text.setText('');
        return;
      }

      text.setText(`${index === this.selected ? '>' : ' '} ${choice.text}`);
      text.setColor(index === this.selected ? '#f3d88f' : '#b8b09c');
    });
  }

  private confirm(): void {
    if (!this.panel.visible || this.state.choices.length === 0) {
      this.cancel();
      return;
    }

    const choice = this.state.choices[this.selected];
    if (!choice) {
      return;
    }

    this.game.events.emit('dialogue:select', choice.id);
  }

  private cancel(): void {
    if (!this.panel.visible) {
      return;
    }

    this.game.events.emit('dialogue:cancel');
  }
}
