import Phaser from 'phaser';
import type { Types } from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { OverworldScene } from '../scenes/OverworldScene';
import { HudScene } from '../scenes/HudScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { SettingsMenuScene } from '../scenes/SettingsMenuScene';
import { CreditsScene } from '../scenes/CreditsScene';
import { InventoryScene } from '../scenes/InventoryScene';
import { CharacterScene } from '../scenes/CharacterScene';
import { QuestJournalScene } from '../scenes/QuestJournalScene';
import { WorldMapScene } from '../scenes/WorldMapScene';
import { DialogueScene } from '../scenes/DialogueScene';

export const gameConfig: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#151412',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [
    BootScene,
    MainMenuScene,
    SettingsMenuScene,
    CreditsScene,
    OverworldScene,
    HudScene,
    InventoryScene,
    CharacterScene,
    QuestJournalScene,
    WorldMapScene,
    DialogueScene
  ],
  input: {
    gamepad: true,
    mouse: {
      preventDefaultWheel: true
    }
  },
  audio: {
    disableWebAudio: false
  }
};
