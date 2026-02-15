import Phaser from 'phaser';
import { REGISTRY_KEYS, type UiPanel } from '../ui/registryKeys';
import { UI_THEME } from '../ui/theme';

interface InventoryPanelState {
  entries: Array<{ index: number; itemId: string | null; amount: number; tags: string[] }>;
  activeTab: 'All' | 'Gear' | 'Consumables' | 'Materials' | 'Quest';
  cinders: number;
  equipment: {
    weapon: string | null;
    offhand: string | null;
    armor: string | null;
    trinkets: [string | null, string | null];
  };
}

const DEFAULT_STATE: InventoryPanelState = {
  entries: [],
  activeTab: 'All',
  cinders: 0,
  equipment: {
    weapon: null,
    offhand: null,
    armor: null,
    trinkets: [null, null]
  }
};

const TABS: InventoryPanelState['activeTab'][] = ['All', 'Gear', 'Consumables', 'Materials', 'Quest'];

export class InventoryScene extends Phaser.Scene {
  private panel!: Phaser.GameObjects.Container;
  private tabTexts: Phaser.GameObjects.Text[] = [];
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private headerText!: Phaser.GameObjects.Text;
  private equipmentText!: Phaser.GameObjects.Text;
  private state: InventoryPanelState = DEFAULT_STATE;

  public constructor() {
    super('inventory-ui');
  }

  public create(): void {
    this.panel = this.add.container(0, 0);
    this.panel.setVisible(false);
    this.panel.setDepth(200);

    const backdrop = this.add.rectangle(640, 360, 1160, 640, UI_THEME.panelFill, UI_THEME.panelAlpha);
    backdrop.setStrokeStyle(2, UI_THEME.panelStroke, 1);
    this.panel.add(backdrop);

    this.headerText = this.add.text(90, 66, 'Inventory', {
      fontFamily: UI_THEME.headerFont,
      fontSize: '34px',
      color: UI_THEME.titleColor
    });
    this.panel.add(this.headerText);

    TABS.forEach((tab, index) => {
      const tabText = this.add.text(90 + index * 190, 116, tab, {
        fontFamily: UI_THEME.bodyFont,
        fontSize: '22px',
        color: UI_THEME.textColor
      });
      this.tabTexts.push(tabText);
      this.panel.add(tabText);
    });

    for (let i = 0; i < 48; i += 1) {
      const col = i % 8;
      const row = Math.floor(i / 8);

      const slotBg = this.add.rectangle(120 + col * 86, 180 + row * 68, 78, 58, 0x181716, 0.9).setOrigin(0, 0);
      slotBg.setStrokeStyle(1, 0x4a463f, 1);
      this.panel.add(slotBg);

      const slotText = this.add.text(126 + col * 86, 186 + row * 68, '--', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#d8d0b8',
        wordWrap: { width: 64 }
      });
      this.panel.add(slotText);
      this.slotTexts.push(slotText);
    }

    this.equipmentText = this.add.text(850, 180, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#d8d0b8',
      lineSpacing: 6
    });
    this.panel.add(this.equipmentText);

    this.add
      .text(100, 635, 'I/Esc: Close | Tab: Cycle Filter', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#9c947e'
      })
      .setDepth(201)
      .setVisible(false)
      .setName('inventoryHelp');

    this.registry.events.on('changedata-uiPanel', this.onPanelChange, this);
    this.registry.events.on('changedata-inventoryState', this.onStateUpdate, this);

    this.input.keyboard?.on('keydown-I', () => this.closeIfOpen());
    this.input.keyboard?.on('keydown-ESC', () => this.closeIfOpen());
    this.input.keyboard?.on('keydown-TAB', () => this.cycleTab());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-uiPanel', this.onPanelChange, this);
      this.registry.events.off('changedata-inventoryState', this.onStateUpdate, this);
      this.input.keyboard?.removeAllListeners();
    });
  }

  private onPanelChange(_parent: unknown, panel: UiPanel): void {
    const visible = panel === 'inventory';
    this.panel.setVisible(visible);
    const helpText = this.children.getByName('inventoryHelp') as Phaser.GameObjects.Text | null;
    helpText?.setVisible(visible);
  }

  private onStateUpdate(_parent: unknown, state: InventoryPanelState): void {
    this.state = state;
    this.render();
  }

  private render(): void {
    this.headerText.setText(`Inventory   Cinders: ${this.state.cinders}`);

    this.tabTexts.forEach((tab, index) => {
      const active = this.state.activeTab === tab.text;
      tab.setColor(active ? UI_THEME.accentColor : UI_THEME.textColor);
    });

    const filtered = this.state.entries.filter((entry) => this.matchesTab(entry));

    for (let i = 0; i < this.slotTexts.length; i += 1) {
      const entry = filtered[i];
      if (!entry || !entry.itemId) {
        this.slotTexts[i].setText('--');
        this.slotTexts[i].setColor('#888274');
        continue;
      }

      this.slotTexts[i].setText(`${entry.itemId.replace(/_/g, ' ')}\nx${entry.amount}`);
      this.slotTexts[i].setColor('#d8d0b8');
    }

    const eq = this.state.equipment;
    this.equipmentText.setText(
      [
        'Equipment',
        `Weapon: ${eq.weapon ?? '--'}`,
        `Offhand: ${eq.offhand ?? '--'}`,
        `Armor: ${eq.armor ?? '--'}`,
        `Trinket 1: ${eq.trinkets[0] ?? '--'}`,
        `Trinket 2: ${eq.trinkets[1] ?? '--'}`
      ].join('\n')
    );
  }

  private matchesTab(entry: InventoryPanelState['entries'][number]): boolean {
    if (this.state.activeTab === 'All') {
      return true;
    }

    if (this.state.activeTab === 'Gear') {
      return entry.tags.includes('gear');
    }

    if (this.state.activeTab === 'Consumables') {
      return entry.tags.includes('consumable');
    }

    if (this.state.activeTab === 'Materials') {
      return entry.tags.includes('material');
    }

    if (this.state.activeTab === 'Quest') {
      return entry.tags.includes('quest') || entry.tags.includes('key');
    }

    return true;
  }

  private cycleTab(): void {
    if (!this.panel.visible) {
      return;
    }

    const current = TABS.indexOf(this.state.activeTab);
    const next = TABS[Phaser.Math.Wrap(current + 1, 0, TABS.length)];
    this.registry.set(REGISTRY_KEYS.inventory, {
      ...this.state,
      activeTab: next
    });
  }

  private closeIfOpen(): void {
    if (!this.panel.visible) {
      return;
    }

    this.registry.set(REGISTRY_KEYS.uiPanel, '');
  }
}
