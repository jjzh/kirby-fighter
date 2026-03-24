import Phaser from 'phaser';
import type { SimulationSnapshot } from '@simulation/types';
import { PLAYER_COLORS, CANVAS_W, CANVAS_H } from '@simulation/constants';

interface PlayerHud {
  damageText: Phaser.GameObjects.Text;
  stockDots: Phaser.GameObjects.Ellipse[];
  nameText: Phaser.GameObjects.Text;
}

export class HudRenderer {
  private playerHuds: PlayerHud[] = [];
  private matchText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, playerCount: number) {
    const hudY = CANVAS_H - 60;
    const sectionWidth = CANVAS_W / playerCount;

    for (let i = 0; i < playerCount; i++) {
      const centerX = sectionWidth * i + sectionWidth / 2;
      const colorStr = '#' + PLAYER_COLORS[i].toString(16).padStart(6, '0');

      const nameText = scene.add.text(centerX, hudY - 20, `P${i + 1}`, {
        fontSize: '14px',
        color: colorStr,
        fontFamily: 'monospace',
      }).setOrigin(0.5);

      const damageText = scene.add.text(centerX, hudY + 5, '0%', {
        fontSize: '32px',
        color: '#FFFFFF',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // Stock dots
      const stockDots: Phaser.GameObjects.Ellipse[] = [];
      for (let s = 0; s < 3; s++) {
        const dot = scene.add.ellipse(
          centerX - 15 + s * 15, hudY + 30, 8, 8,
          PLAYER_COLORS[i]
        );
        stockDots.push(dot);
      }

      this.playerHuds.push({ damageText, stockDots, nameText });
    }

    // Match status text (hidden by default)
    this.matchText = scene.add.text(CANVAS_W / 2, CANVAS_H / 2, '', {
      fontSize: '48px',
      color: '#FFFFFF',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setVisible(false);
  }

  update(snapshot: SimulationSnapshot): void {
    for (let i = 0; i < this.playerHuds.length; i++) {
      const hud = this.playerHuds[i];
      const fighter = snapshot.fighters[i];

      hud.damageText.setText(`${Math.floor(fighter.damage)}%`);

      // Color damage text red as it gets higher
      const intensity = Math.min(fighter.damage / 150, 1);
      const r = Math.floor(255);
      const g = Math.floor(255 * (1 - intensity));
      const b = Math.floor(255 * (1 - intensity));
      hud.damageText.setColor(`rgb(${r},${g},${b})`);

      // Update stock dots
      for (let s = 0; s < hud.stockDots.length; s++) {
        hud.stockDots[s].setAlpha(s < fighter.stocks ? 1 : 0.2);
      }
    }

    // Match end display
    if (snapshot.matchPhase === 'ended') {
      this.matchText.setVisible(true);
      if (snapshot.winnerIndex >= 0) {
        this.matchText.setText(`P${snapshot.winnerIndex + 1} WINS!`);
        const colorStr = '#' + PLAYER_COLORS[snapshot.winnerIndex].toString(16).padStart(6, '0');
        this.matchText.setColor(colorStr);
      } else {
        this.matchText.setText('DRAW!');
      }
    }
  }
}
