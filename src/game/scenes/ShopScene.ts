import Phaser from 'phaser';
import { REGISTRY_KEYS, type UiPanel } from '../ui/registryKeys';
import { UI_THEME } from '../ui/theme';

interface ShopListingView {
  id: string;
  label: string;
  price: number;
  stock: number;
}

interface ShopSellView {
  itemId: string;
  label: string;
  amount: number;
  sellValue: number;
}

interface ShopState {
  title: string;
  cinders: number;
  restockInSeconds: number;
  listings: ShopListingView[];
  sellable: ShopSellView[];
  message?: string;
}

const DEFAULT_STATE: ShopState = {
  title: 'Foundry Market',
  cinders: 0,
  restockInSeconds: 0,
  listings: [],
  sellable: []
};

type ShopTab = 'buy' | 'sell';

export class ShopScene extends Phaser.Scene {
  private panel!: Phaser.GameObjects.Container;
  private headerText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private buyLines: Phaser.GameObjects.Text[] = [];
  private sellLines: Phaser.GameObjects.Text[] = [];
  private tabText!: Phaser.GameObjects.Text;

  private state: ShopState = DEFAULT_STATE;
  private tab: ShopTab = 'buy';
  private selectedBuy = 0;
  private selectedSell = 0;

  public constructor() {
    super('shop-ui');
  }

  public create(): void {
    this.panel = this.add.container(0, 0).setDepth(220).setVisible(false);

    const bg = this.add.rectangle(640, 360, 1140, 620, UI_THEME.panelFill, UI_THEME.panelAlpha);
    bg.setStrokeStyle(2, UI_THEME.panelStroke);
    this.panel.add(bg);

    this.headerText = this.add.text(98, 74, '', {
      fontFamily: UI_THEME.headerFont,
      fontSize: '34px',
      color: UI_THEME.titleColor
    });
    this.panel.add(this.headerText);

    this.tabText = this.add.text(98, 118, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#b9b09a'
    });
    this.panel.add(this.tabText);

    this.panel.add(
      this.add.text(98, 154, 'Buy', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#d5cda9'
      })
    );

    this.panel.add(
      this.add.text(620, 154, 'Sell', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#d5cda9'
      })
    );

    for (let i = 0; i < 10; i += 1) {
      const buyLine = this.add.text(98, 188 + i * 34, '', {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#d7d1bf'
      });
      this.buyLines.push(buyLine);
      this.panel.add(buyLine);

      const sellLine = this.add.text(620, 188 + i * 34, '', {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#d7d1bf'
      });
      this.sellLines.push(sellLine);
      this.panel.add(sellLine);
    }

    this.messageText = this.add.text(98, 556, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#b3b5a5'
    });
    this.panel.add(this.messageText);

    this.panel.add(
      this.add.text(98, 586, 'Tab: Switch column  Up/Down: Select  Enter: Confirm  Esc: Close', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#97907a'
      })
    );

    this.registry.events.on(`changedata-${REGISTRY_KEYS.uiPanel}`, this.onPanelChange, this);
    this.registry.events.on(`changedata-${REGISTRY_KEYS.shop}`, this.onShopState, this);

    this.input.keyboard?.on('keydown-TAB', this.switchTab, this);
    this.input.keyboard?.on('keydown-UP', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-W', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-S', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-ENTER', this.confirm, this);
    this.input.keyboard?.on('keydown-SPACE', this.confirm, this);
    this.input.keyboard?.on('keydown-ESC', this.close, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(`changedata-${REGISTRY_KEYS.uiPanel}`, this.onPanelChange, this);
      this.registry.events.off(`changedata-${REGISTRY_KEYS.shop}`, this.onShopState, this);
      this.input.keyboard?.removeAllListeners();
    });
  }

  private onPanelChange(_parent: unknown, panel: UiPanel): void {
    const visible = panel === 'shop';
    this.panel.setVisible(visible);
    if (visible) {
      this.render();
    }
  }

  private onShopState(_parent: unknown, state: ShopState): void {
    this.state = state;
    this.selectedBuy = Phaser.Math.Clamp(this.selectedBuy, 0, Math.max(0, state.listings.length - 1));
    this.selectedSell = Phaser.Math.Clamp(this.selectedSell, 0, Math.max(0, state.sellable.length - 1));
    this.render();
  }

  private switchTab(): void {
    if (!this.panel.visible) {
      return;
    }

    this.tab = this.tab === 'buy' ? 'sell' : 'buy';
    this.render();
  }

  private moveSelection(delta: number): void {
    if (!this.panel.visible) {
      return;
    }

    if (this.tab === 'buy') {
      const len = this.state.listings.length;
      if (len === 0) {
        return;
      }
      this.selectedBuy = Phaser.Math.Wrap(this.selectedBuy + delta, 0, len);
    } else {
      const len = this.state.sellable.length;
      if (len === 0) {
        return;
      }
      this.selectedSell = Phaser.Math.Wrap(this.selectedSell + delta, 0, len);
    }

    this.render();
  }

  private confirm(): void {
    if (!this.panel.visible) {
      return;
    }

    if (this.tab === 'buy') {
      const listing = this.state.listings[this.selectedBuy];
      if (!listing) {
        return;
      }
      this.game.events.emit('shop:buy', listing.id);
      return;
    }

    const sell = this.state.sellable[this.selectedSell];
    if (!sell) {
      return;
    }

    this.game.events.emit('shop:sell', sell.itemId);
  }

  private close(): void {
    if (!this.panel.visible) {
      return;
    }

    this.registry.set(REGISTRY_KEYS.uiPanel, '');
  }

  private render(): void {
    this.headerText.setText(`${this.state.title}   Cinders: ${this.state.cinders}`);
    this.tabText.setText(
      `Restock in ${this.state.restockInSeconds}s   Active column: ${this.tab.toUpperCase()}`
    );

    this.buyLines.forEach((line, index) => {
      const listing = this.state.listings[index];
      if (!listing) {
        line.setText('');
        return;
      }

      const selected = this.tab === 'buy' && index === this.selectedBuy;
      const stock = listing.stock <= 0 ? 'OUT' : `x${listing.stock}`;
      line.setText(`${selected ? '>' : ' '} ${listing.label}  ${listing.price}c  ${stock}`);
      line.setColor(selected ? '#f0d188' : listing.stock <= 0 ? '#827a67' : '#d7d1bf');
    });

    this.sellLines.forEach((line, index) => {
      const sell = this.state.sellable[index];
      if (!sell) {
        line.setText('');
        return;
      }

      const selected = this.tab === 'sell' && index === this.selectedSell;
      line.setText(`${selected ? '>' : ' '} ${sell.label} x${sell.amount}  +${sell.sellValue}c`);
      line.setColor(selected ? '#f0d188' : '#d7d1bf');
    });

    this.messageText.setText(this.state.message ?? 'Trade with the Foundry Guild.');
  }
}
