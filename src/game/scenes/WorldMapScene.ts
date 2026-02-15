import Phaser from 'phaser';
import { REGISTRY_KEYS, type UiPanel } from '../ui/registryKeys';
import { UI_THEME } from '../ui/theme';

interface WorldMapState {
  currentRegion: string;
  unlocked: string[];
  discovered: string[];
}

const REGION_POSITIONS: Record<string, { x: number; y: number; label: string }> = {
  cinderhaven: { x: 300, y: 280, label: 'Cinderhaven' },
  gloamwood: { x: 540, y: 220, label: 'Gloamwood' },
  salt_quarry: { x: 560, y: 420, label: 'Salt Quarry' },
  mirror_marsh: { x: 820, y: 220, label: 'Mirror Marsh' },
  sunken_spire: { x: 980, y: 360, label: 'Sunken Spire' }
};

export class WorldMapScene extends Phaser.Scene {
  private panel!: Phaser.GameObjects.Container;
  private state: WorldMapState = { currentRegion: 'cinderhaven', unlocked: [], discovered: [] };
  private markers = new Map<string, Phaser.GameObjects.Arc>();
  private labels = new Map<string, Phaser.GameObjects.Text>();

  public constructor() {
    super('world-map-ui');
  }

  public create(): void {
    this.panel = this.add.container(0, 0).setDepth(200).setVisible(false);

    const bg = this.add.rectangle(640, 360, 1120, 620, UI_THEME.panelFill, UI_THEME.panelAlpha);
    bg.setStrokeStyle(2, UI_THEME.panelStroke);
    this.panel.add(bg);

    this.panel.add(
      this.add.text(110, 80, 'World Map', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: UI_THEME.titleColor
      })
    );

    this.panel.add(
      this.add.text(110, 118, 'Discovered regions are bright. Locked paths remain hidden in Silt.', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#9f977f'
      })
    );

    for (const [id, position] of Object.entries(REGION_POSITIONS)) {
      const marker = this.add.circle(position.x, position.y, 18, 0x403c34, 0.95);
      const label = this.add.text(position.x + 26, position.y - 10, position.label, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#766f61'
      });

      this.markers.set(id, marker);
      this.labels.set(id, label);
      this.panel.add(marker);
      this.panel.add(label);
    }

    this.registry.events.on('changedata-uiPanel', this.onPanelChange, this);
    this.registry.events.on('changedata-worldMapState', this.onMapState, this);

    this.input.keyboard?.on('keydown-M', () => this.closeIfOpen());
    this.input.keyboard?.on('keydown-ESC', () => this.closeIfOpen());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-uiPanel', this.onPanelChange, this);
      this.registry.events.off('changedata-worldMapState', this.onMapState, this);
      this.input.keyboard?.removeAllListeners();
    });
  }

  private onPanelChange(_parent: unknown, panel: UiPanel): void {
    this.panel.setVisible(panel === 'map');
  }

  private onMapState(_parent: unknown, state: WorldMapState): void {
    this.state = state;
    this.render();
  }

  private render(): void {
    for (const [id, marker] of this.markers.entries()) {
      const discovered = this.state.discovered.includes(id);
      const unlocked = this.state.unlocked.includes(id);
      const current = this.state.currentRegion === id;

      if (current) {
        marker.setFillStyle(0xd3a14b, 1);
      } else if (discovered) {
        marker.setFillStyle(0x95b6a8, 1);
      } else if (unlocked) {
        marker.setFillStyle(0x706959, 1);
      } else {
        marker.setFillStyle(0x2a2927, 1);
      }

      const label = this.labels.get(id);
      label?.setColor(current ? '#f0d791' : discovered ? '#c5d6cc' : unlocked ? '#b5ad98' : '#746e62');
    }
  }

  private closeIfOpen(): void {
    if (!this.panel.visible) {
      return;
    }
    this.registry.set(REGISTRY_KEYS.uiPanel, '');
  }
}
