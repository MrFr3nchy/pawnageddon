import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  create() {
    const { width: W, height: H } = this.cameras.main;

    // Dark background
    this.add.rectangle(W/2, H/2, W, H, 0x0a0a0e);

    // Generate spark texture first
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff).fillCircle(4, 4, 4);
    g.generateTexture('spark', 8, 8);
    g.destroy();

    // Particle emitter — gold sparks raining down
    this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: W },
      y: -10,
      quantity: 1,
      frequency: 100,
      lifespan: 3200,
      gravityY: 55,
      speedX: { min: -20, max: 20 },
      speedY: { min: 40, max: 100 },
      scale: { start: 0.07, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: [0xdaaf3e, 0xff8800, 0xffffff],
      blendMode: 'ADD',
      emitting: true,
    });

    // Title image centered
    const img = this.add.image(W/2, H * 0.38, 'title');
    const scale = Math.min((W * 0.6) / img.width, (H * 0.55) / img.height);
    img.setScale(scale).setAlpha(0);

    // Animate title in
    this.tweens.add({ targets: img, alpha: 1, y: H * 0.36, duration: 800, ease: 'Power2' });

    // Subtitle
    const sub = this.add.text(W/2, H * 0.62, 'Chess. But chaotic.', {
      fontSize: '20px', fontFamily: 'Segoe UI, sans-serif', color: '#aaa', fontStyle: 'italic',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 400 });

    // Play button
    const btnBg = this.add.rectangle(W/2, H * 0.76, 200, 52, 0xdaaf3e, 0).setStrokeStyle(2, 0xdaaf3e);
    const btnTxt = this.add.text(W/2, H * 0.76, 'PLAY', { fontSize: '24px', fontFamily: 'Segoe UI, sans-serif', color: '#daaf3e', fontStyle: 'bold' }).setOrigin(0.5);
    [btnBg, btnTxt].forEach(o => o.setAlpha(0));
    this.tweens.add({ targets: [btnBg, btnTxt], alpha: 1, duration: 500, delay: 700 });

    // Pulse animation
    this.tweens.add({ targets: [btnBg, btnTxt], scaleX: 1.04, scaleY: 1.04, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut', delay: 1200 });

    // Hover effect
    btnBg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { btnBg.setFillStyle(0xdaaf3e, 0.15); btnTxt.setColor('#ffffff'); })
      .on('pointerout',  () => { btnBg.setFillStyle(0xdaaf3e, 0); btnTxt.setColor('#daaf3e'); })
      .on('pointerdown', () => this._startGame());

    btnTxt.setInteractive({ useHandCursor: true }).on('pointerdown', () => this._startGame());

    // Click anywhere
    this.input.on('pointerdown', (ptr) => {
      if (ptr.y < H * 0.68) this._startGame();
    });
  }

  _startGame() {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(420, () => this.scene.start('GameScene'));
  }
}
