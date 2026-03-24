import Phaser from 'phaser';
import { PLAYER_COLORS, CANVAS_W, CANVAS_H } from '@simulation/constants';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create(data: { winnerIndex: number }): void {
    const bg = this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x000000, 0.8);

    if (data.winnerIndex >= 0) {
      const colorStr = '#' + PLAYER_COLORS[data.winnerIndex].toString(16).padStart(6, '0');
      this.add.text(CANVAS_W / 2, CANVAS_H / 2 - 40, `P${data.winnerIndex + 1} WINS!`, {
        fontSize: '64px',
        color: colorStr,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      }).setOrigin(0.5);
    }

    const isTouchDevice = this.sys.game.device.input.touch;
    this.add.text(CANVAS_W / 2, CANVAS_H / 2 + 40,
      isTouchDevice ? 'Tap to rematch' : 'Press ENTER to rematch', {
      fontSize: '20px',
      color: '#AAAAAA',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.input.keyboard!.on('keydown-ENTER', () => {
      this.scene.start('GameScene');
    });

    this.input.on('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }
}
