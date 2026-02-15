import Phaser from 'phaser';
import { REGISTRY_KEYS, type UiPanel } from '../ui/registryKeys';
import { UI_THEME } from '../ui/theme';

interface QuestEntry {
  id: string;
  title: string;
  status: string;
  objectives: Array<{ id: string; description: string; progress: number; required: number }>;
}

interface QuestJournalState {
  quests: QuestEntry[];
}

export class QuestJournalScene extends Phaser.Scene {
  private panel!: Phaser.GameObjects.Container;
  private listText!: Phaser.GameObjects.Text;

  public constructor() {
    super('quest-journal-ui');
  }

  public create(): void {
    this.panel = this.add.container(0, 0).setDepth(200).setVisible(false);

    const bg = this.add.rectangle(640, 360, 1100, 620, UI_THEME.panelFill, UI_THEME.panelAlpha);
    bg.setStrokeStyle(2, UI_THEME.panelStroke);
    this.panel.add(bg);

    this.panel.add(
      this.add.text(110, 80, 'Quest Journal', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: UI_THEME.titleColor
      })
    );

    this.listText = this.add.text(110, 140, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: UI_THEME.textColor,
      wordWrap: { width: 1020 },
      lineSpacing: 5
    });
    this.panel.add(this.listText);

    this.registry.events.on('changedata-uiPanel', this.onPanelChange, this);
    this.registry.events.on('changedata-questJournalState', this.onStateChange, this);

    this.input.keyboard?.on('keydown-J', () => this.closeIfOpen());
    this.input.keyboard?.on('keydown-ESC', () => this.closeIfOpen());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-uiPanel', this.onPanelChange, this);
      this.registry.events.off('changedata-questJournalState', this.onStateChange, this);
      this.input.keyboard?.removeAllListeners();
    });
  }

  private onPanelChange(_parent: unknown, panel: UiPanel): void {
    this.panel.setVisible(panel === 'quests');
  }

  private onStateChange(_parent: unknown, state: QuestJournalState): void {
    if (state.quests.length === 0) {
      this.listText.setText('No quests tracked yet.');
      return;
    }

    const lines: string[] = [];

    for (const quest of state.quests) {
      lines.push(`${quest.title} [${quest.status.toUpperCase()}]`);
      for (const objective of quest.objectives) {
        lines.push(`  - ${objective.description}: ${objective.progress}/${objective.required}`);
      }
      lines.push('');
    }

    this.listText.setText(lines.join('\n'));
  }

  private closeIfOpen(): void {
    if (!this.panel.visible) {
      return;
    }
    this.registry.set(REGISTRY_KEYS.uiPanel, '');
  }
}
