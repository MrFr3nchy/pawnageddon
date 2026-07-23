import Phaser from 'phaser';
import { PIECE_ASSETS } from '../game/constants.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // Progress bar
    const w = this.cameras.main.width, h = this.cameras.main.height;
    const bar = this.add.graphics();
    const box = this.add.graphics();
    box.fillStyle(0x222222).fillRect(w/2 - 160, h/2 - 12, 320, 24);
    const text = this.add.text(w/2, h/2 - 40, 'Loading...', { color:'#daaf3e', fontSize:'18px', fontFamily:'Segoe UI, sans-serif' }).setOrigin(0.5);

    this.load.on('progress', v => { bar.clear().fillStyle(0xdaaf3e).fillRect(w/2 - 158, h/2 - 10, 316 * v, 20); });
    this.load.on('complete', () => { bar.destroy(); box.destroy(); text.destroy(); });

    // Load all piece images
    for (const [key, path] of Object.entries(PIECE_ASSETS)) {
      this.load.image(`piece_${key}`, `assets/${path}`);
    }
    this.load.image('title', 'assets/pawnageddon-title.png');
  }

  create() {
    this.scene.start('TitleScene');
  }
}
