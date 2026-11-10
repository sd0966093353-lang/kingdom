import Phaser from 'phaser';
import { ForestScene } from './ForestScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-stage',
  backgroundColor: '#233d2c',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 600,
  },
  render: { antialias: true, pixelArt: false },
  scene: [ForestScene],
};
