import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';

export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    ...gameConfig,
    parent
  });
}
