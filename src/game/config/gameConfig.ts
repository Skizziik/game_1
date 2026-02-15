import Phaser from 'phaser';
import type { Types } from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { OverworldScene } from '../scenes/OverworldScene';
import { HudScene } from '../scenes/HudScene';

export const gameConfig: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#151412',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [BootScene, OverworldScene, HudScene],
  input: {
    gamepad: true
  },
  audio: {
    disableWebAudio: false
  }
};
