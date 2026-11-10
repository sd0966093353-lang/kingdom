import Phaser from 'phaser';
import { useGameStore } from './store';
import type { EnemyKind, TowerKind } from './types';

interface Enemy {
  x: number;
  y: number;
  pathIndex: number;
  progress: number;
  hp: number;
  maxHp: number;
  speed: number;
  kind: EnemyKind;
  radius: number;
  reward: number;
  escaped?: boolean;
}

interface Shot {
  x: number;
  y: number;
  target: Enemy;
  speed: number;
  damage: number;
  color: number;
  splash: number;
}

interface Ally {
  x: number;
  y: number;
  life: number;
}

const PATH = [
  { x: -24, y: 198 }, { x: 142, y: 198 }, { x: 142, y: 355 },
  { x: 322, y: 355 }, { x: 322, y: 205 }, { x: 492, y: 205 },
  { x: 492, y: 392 }, { x: 666, y: 392 }, { x: 666, y: 248 },
  { x: 838, y: 248 }, { x: 838, y: 315 }, { x: 974, y: 315 },
];

const ENEMIES: Record<EnemyKind, { hp: number; speed: number; reward: number; color: number; radius: number; label: string }> = {
  goblin: { hp: 48, speed: 54, reward: 9, color: 0x86bd56, radius: 11, label: '哥布林' },
  orc: { hp: 120, speed: 36, reward: 15, color: 0xb65a49, radius: 14, label: '獸人' },
  wolf: { hp: 85, speed: 88, reward: 14, color: 0x8795a4, radius: 12, label: '狼騎兵' },
  knight: { hp: 235, speed: 25, reward: 22, color: 0x9ca8aa, radius: 15, label: '裝甲騎士' },
  demon: { hp: 155, speed: 47, reward: 20, color: 0xb56ace, radius: 14, label: '飛行惡魔' },
  boss: { hp: 1850, speed: 19, reward: 180, color: 0x9d3441, radius: 24, label: '森林魔王' },
};

const TOWERS: Record<TowerKind, { range: number; rate: number; damage: number; color: number }> = {
  archer: { range: 144, rate: 0.62, damage: 22, color: 0xd7e87b },
  mage: { range: 155, rate: 1.05, damage: 55, color: 0xc49bff },
  cannon: { range: 136, rate: 1.5, damage: 74, color: 0xffa45f },
  barracks: { range: 65, rate: 0.88, damage: 18, color: 0x73d4dc },
};

export class ForestScene extends Phaser.Scene {
  private art!: Phaser.GameObjects.Graphics;
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private allies: Ally[] = [];
  private waveQueue: EnemyKind[] = [];
  private spawnTimer = 0;
  private towerTimers = new Map<number, number>();
  private hero = { x: 488, y: 300, targetX: 488, targetY: 300, attack: 0 };
  private meteorEffect = 0;
  private meteorX = 510;
  private meteorY = 280;
  private ambient = 0;
  private cooldownUiTimer = 0;
  private cooldownUiElapsed = 0;
  private lastCombatSound = 0;
  private audioContext: AudioContext | null = null;
  private toastLabel!: Phaser.GameObjects.Text;
  private readonly startWaveListener = () => this.beginNextWave();
  private readonly meteorListener = () => this.castMeteor();
  private readonly allyListener = () => this.summonAllies();
  private readonly earlyWaveListener = () => this.beginEarlyWave();
  private readonly unlockAudioListener = () => this.unlockAudio();

  constructor() {
    super('ForestScene');
  }

  create() {
    this.toastLabel = this.add.text(480, 68, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#fff0c8',
      fontStyle: 'bold', stroke: '#273329', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);
    this.toastLabel.setVisible(false);
    this.drawBackground();
    this.art = this.add.graphics();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (useGameStore.getState().phase !== 'playing') return;
      const state = useGameStore.getState();
      const slot = state.slots.find((item) => Phaser.Math.Distance.Between(item.x, item.y, pointer.worldX, pointer.worldY) < 29);
      if (slot) {
        state.selectSlot(slot.id);
        return;
      }
      state.selectSlot(null);
      this.hero.targetX = Phaser.Math.Clamp(pointer.worldX, 35, 900);
      this.hero.targetY = Phaser.Math.Clamp(pointer.worldY, 55, 550);
    });
    window.addEventListener('start-wave', this.startWaveListener);
    window.addEventListener('cast-meteor', this.meteorListener);
    window.addEventListener('call-reinforcements', this.allyListener);
    window.addEventListener('early-wave', this.earlyWaveListener);
    window.addEventListener('pointerdown', this.unlockAudioListener, { once: true });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('start-wave', this.startWaveListener);
      window.removeEventListener('cast-meteor', this.meteorListener);
      window.removeEventListener('call-reinforcements', this.allyListener);
      window.removeEventListener('early-wave', this.earlyWaveListener);
      window.removeEventListener('pointerdown', this.unlockAudioListener);
      void this.audioContext?.close();
    });
  }

  private drawBackground() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x355d3d, 0x355d3d, 0x243f30, 0x243f30, 1);
    bg.fillRect(0, 0, 960, 600);
    for (let i = 0; i < 95; i++) {
      const x = (i * 173 + 37) % 950;
      const y = (i * 97 + 61) % 580;
      if (this.distanceToPath(x, y) < 56) continue;
      const size = 10 + (i % 5) * 3;
      bg.fillStyle(i % 3 === 0 ? 0x47724a : 0x3d6943, 0.48);
      bg.fillCircle(x, y, size + 3);
      bg.fillStyle(i % 4 === 0 ? 0x6a8b4e : 0x567d48, 0.76);
      bg.fillCircle(x - 2, y - 3, size);
      bg.fillStyle(0x8c7048, 0.8);
      bg.fillRect(x - 2, y + size - 2, 4, 9);
      if (i % 7 === 0) {
        bg.fillStyle(0xdacb87, 0.7);
        bg.fillCircle(x + 10, y + 9, 2);
      }
    }
    bg.lineStyle(44, 0x182b20, 0.18);
    bg.strokePoints(PATH.map((point) => new Phaser.Math.Vector2(point.x, point.y)), false);
    bg.lineStyle(34, 0x8e744c, 1);
    bg.strokePoints(PATH.map((point) => new Phaser.Math.Vector2(point.x, point.y)), false);
    bg.lineStyle(25, 0xc8ad72, 1);
    bg.strokePoints(PATH.map((point) => new Phaser.Math.Vector2(point.x, point.y)), false);
    bg.lineStyle(2, 0xd5c18d, 0.35);
    bg.strokePoints(PATH.map((point) => new Phaser.Math.Vector2(point.x, point.y)), false);
    this.drawCastle(bg);
    bg.fillStyle(0x172b1e, 0.32);
    bg.fillRoundedRect(10, 9, 171, 27, 8);
    bg.fillStyle(0xd6e0b7, 0.9);
    bg.fillCircle(25, 22, 4);
    bg.fillCircle(37, 22, 4);
    bg.fillCircle(49, 22, 4);
    bg.fillStyle(0x172b1e, 0.34);
    bg.fillRoundedRect(782, 10, 166, 25, 8);
    bg.fillStyle(0xe4c89a, 0.9);
    bg.fillEllipse(802, 22, 13, 7);
    bg.fillStyle(0x47724a, 0.95);
    bg.fillCircle(915, 25, 12);
    bg.fillCircle(936, 29, 15);
  }

  private drawCastle(g: Phaser.GameObjects.Graphics) {
    g.fillStyle(0x503e34);
    g.fillRoundedRect(906, 269, 59, 93, 5);
    g.fillStyle(0xbab5a1);
    g.fillRoundedRect(912, 278, 45, 80, 5);
    g.fillStyle(0x777e70);
    g.fillTriangle(905, 280, 934, 250, 963, 280);
    g.fillTriangle(906, 277, 919, 262, 931, 278);
    g.fillTriangle(938, 278, 950, 262, 963, 280);
    g.fillStyle(0x8e453e);
    g.fillRect(915, 270, 7, 15);
    g.fillRect(947, 270, 7, 15);
    g.fillStyle(0x614738);
    g.fillRoundedRect(928, 325, 15, 33, 7);
    g.fillStyle(0xf0cd69);
    g.fillCircle(934, 295, 4);
  }

  private distanceToPath(x: number, y: number) {
    return Math.min(...PATH.slice(1).map((point, index) => {
      const previous = PATH[index];
      const segment = new Phaser.Math.Vector2(point.x - previous.x, point.y - previous.y);
      const offset = new Phaser.Math.Vector2(x - previous.x, y - previous.y);
      const t = Phaser.Math.Clamp(offset.dot(segment) / segment.lengthSq(), 0, 1);
      return Phaser.Math.Distance.Between(x, y, previous.x + segment.x * t, previous.y + segment.y * t);
    }));
  }

  private beginNextWave() {
    const state = useGameStore.getState();
    if (state.phase !== 'playing' || state.waveActive || state.wave >= 20) return;
    const wave = state.wave + 1;
    this.waveQueue = this.makeWave(wave);
    this.spawnTimer = 0;
    useGameStore.getState().setWave(wave, true);
    useGameStore.getState().showMessage(wave === 20 ? '最後一波 — 森林魔王來襲！' : `第 ${wave} 波敵人來襲！`, 2200);
    this.playTone(300, 0.16, 'triangle');
  }

  private makeWave(wave: number): EnemyKind[] {
    const queue: EnemyKind[] = [];
    const count = 7 + Math.floor(wave * 1.35);
    for (let i = 0; i < count; i++) {
      if (wave === 20 && i === count - 1) queue.push('boss');
      else if (wave >= 12 && i % 5 === 3) queue.push('demon');
      else if (wave >= 8 && i % 4 === 2) queue.push('knight');
      else if (wave >= 5 && i % 3 === 1) queue.push('wolf');
      else if (wave >= 3 && i % 3 === 2) queue.push('orc');
      else queue.push('goblin');
    }
    return queue;
  }

  private beginEarlyWave() {
    const state = useGameStore.getState();
    if (!state.canCallEarly || !state.waveActive || state.wave >= 20) return;
    const nextWave = state.wave + 1;
    this.waveQueue.push(...this.makeWave(nextWave));
    this.spawnTimer = 0;
    state.setWave(nextWave, true);
    state.setGold(state.gold + 25);
    state.showMessage(`提前召喚第 ${nextWave} 波！獎勵 +25 金幣`, 2400);
    this.playTone(420, 0.2, 'triangle');
  }

  private unlockAudio() {
    if (this.audioContext) return;
    try {
      this.audioContext = new AudioContext();
      if (this.audioContext.state === 'suspended') void this.audioContext.resume();
    } catch (error) {
      console.warn('無法啟用遊戲音效：', error);
    }
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.audioContext || this.audioContext.state !== 'running') return;
    try {
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      gain.gain.setValueAtTime(0.055, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.warn('無法播放遊戲音效：', error);
    }
  }

  private spawnEnemy(kind: EnemyKind) {
    const data = ENEMIES[kind];
    const wave = useGameStore.getState().wave;
    const multiplier = 1 + (wave - 1) * 0.105;
    this.enemies.push({
      x: PATH[0].x, y: PATH[0].y, pathIndex: 1, progress: 0,
      hp: data.hp * multiplier, maxHp: data.hp * multiplier,
      speed: data.speed * (kind === 'boss' ? 1 + (wave - 20) * 0.02 : 1 + (wave - 1) * 0.008),
      kind, radius: data.radius, reward: data.reward + Math.floor(wave * 0.7),
    });
  }

  private damageEnemy(enemy: Enemy, damage: number) {
    if (enemy.escaped) return;
    enemy.hp -= damage;
    if (enemy.hp <= 0) {
      enemy.escaped = true;
      const state = useGameStore.getState();
      state.setGold(state.gold + enemy.reward);
    }
  }

  private castMeteor() {
    const state = useGameStore.getState();
    if (state.phase !== 'playing' || state.meteorCooldown > 0) return;
    this.meteorX = 510;
    this.meteorY = 295;
    this.meteorEffect = 0.9;
    for (const enemy of this.enemies) {
      if (Phaser.Math.Distance.Between(enemy.x, enemy.y, this.meteorX, this.meteorY) < 155) {
        this.damageEnemy(enemy, enemy.kind === 'boss' ? enemy.maxHp * 0.09 : enemy.maxHp * 0.48);
      }
    }
    state.setCooldown('meteor', 24);
    state.showMessage('☄ 流星火雨！');
    this.playTone(150, 0.5, 'sawtooth');
    this.playTone(580, 0.22, 'sine');
  }

  private summonAllies() {
    const state = useGameStore.getState();
    if (state.phase !== 'playing' || state.reinforcementsCooldown > 0) return;
    this.allies.push({ x: 465, y: 285, life: 15 }, { x: 482, y: 305, life: 15 }, { x: 500, y: 285, life: 15 });
    state.setCooldown('reinforcements', 32);
    state.showMessage('🛡️ 王國援軍抵達！');
    this.playTone(520, 0.16, 'triangle');
  }

  update(_time: number, rawDelta: number) {
    const state = useGameStore.getState();
    if (state.phase !== 'playing') {
      this.renderScene(0);
      return;
    }
    const delta = Math.min(rawDelta, 50) / 1000 * state.speed;
    this.ambient += delta;
    this.cooldownUiTimer -= delta;
    this.cooldownUiElapsed += delta;
    if (this.cooldownUiTimer <= 0) {
      if (state.meteorCooldown > 0) state.setCooldown('meteor', Math.max(0, state.meteorCooldown - this.cooldownUiElapsed));
      if (state.reinforcementsCooldown > 0) state.setCooldown('reinforcements', Math.max(0, state.reinforcementsCooldown - this.cooldownUiElapsed));
      this.cooldownUiElapsed = 0;
      this.cooldownUiTimer = 0.12;
    }
    if (this.meteorEffect > 0) this.meteorEffect = Math.max(0, this.meteorEffect - delta);

    if (this.waveQueue.length) {
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        const next = this.waveQueue.shift();
        if (next) this.spawnEnemy(next);
        this.spawnTimer = Math.max(0.48, 1.12 - state.wave * 0.018);
      }
    }

    for (const enemy of this.enemies) {
      if (enemy.escaped) continue;
      const target = PATH[enemy.pathIndex];
      if (!target) {
        enemy.escaped = true;
        const lives = useGameStore.getState().lives - (enemy.kind === 'boss' ? 6 : enemy.kind === 'knight' ? 2 : 1);
        useGameStore.getState().setLives(lives);
        if (lives <= 0) {
          useGameStore.getState().setPhase('lost');
          useGameStore.getState().showMessage('城堡失守了！', 5000);
        }
        continue;
      }
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, target.x, target.y);
      const step = enemy.speed * delta;
      if (distance <= step) {
        enemy.x = target.x; enemy.y = target.y; enemy.pathIndex++;
      } else {
        enemy.x += (target.x - enemy.x) / distance * step;
        enemy.y += (target.y - enemy.y) / distance * step;
      }
    }

    const heroDistance = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, this.hero.targetX, this.hero.targetY);
    if (heroDistance > 3) {
      const move = Math.min(140 * delta, heroDistance);
      this.hero.x += (this.hero.targetX - this.hero.x) / heroDistance * move;
      this.hero.y += (this.hero.targetY - this.hero.y) / heroDistance * move;
    }
    this.hero.attack -= delta;
    if (this.hero.attack <= 0) {
      const target = this.enemies.filter((enemy) => !enemy.escaped && Phaser.Math.Distance.Between(enemy.x, enemy.y, this.hero.x, this.hero.y) < 75)
        .sort((a, b) => b.pathIndex - a.pathIndex)[0];
      if (target) {
        this.damageEnemy(target, 32);
        this.hero.attack = 0.75;
      }
    }

    for (const slot of useGameStore.getState().slots) {
      if (!slot.tower) continue;
      const tower = slot.tower;
      const stats = TOWERS[tower.kind];
      const timer = (this.towerTimers.get(slot.id) || 0) - delta;
      if (timer <= 0) {
        const target = this.enemies.filter((enemy) => !enemy.escaped
          && Phaser.Math.Distance.Between(slot.x, slot.y, enemy.x, enemy.y) <= stats.range + (tower.level - 1) * 13)
          .sort((a, b) => b.pathIndex + b.progress - a.pathIndex - a.progress)[0];
        if (target && tower.kind !== 'barracks') {
          this.shots.push({ x: slot.x, y: slot.y - 20, target, speed: tower.kind === 'mage' ? 390 : 470,
            damage: stats.damage * (1 + (tower.level - 1) * 0.62), color: stats.color,
            splash: tower.kind === 'cannon' ? 48 + tower.level * 6 : 0 });
          this.towerTimers.set(slot.id, stats.rate / (1 + (tower.level - 1) * 0.13));
        } else if (tower.kind === 'barracks') {
          const nearby = this.enemies.find((enemy) => !enemy.escaped
            && Phaser.Math.Distance.Between(slot.x, slot.y, enemy.x, enemy.y) < stats.range + 15);
          if (nearby) {
            this.damageEnemy(nearby, stats.damage * (1 + (tower.level - 1) * 0.65));
            this.towerTimers.set(slot.id, stats.rate);
          } else this.towerTimers.set(slot.id, 0.15);
        } else this.towerTimers.set(slot.id, 0.16);
      } else this.towerTimers.set(slot.id, timer);
    }

    for (const shot of this.shots) {
      if (shot.target.escaped) { shot.x = -100; continue; }
      const distance = Phaser.Math.Distance.Between(shot.x, shot.y, shot.target.x, shot.target.y);
      const step = shot.speed * delta;
      if (distance <= step + shot.target.radius) {
        if (shot.splash) {
          for (const enemy of this.enemies) if (!enemy.escaped
            && Phaser.Math.Distance.Between(enemy.x, enemy.y, shot.target.x, shot.target.y) < shot.splash) this.damageEnemy(enemy, shot.damage);
        } else this.damageEnemy(shot.target, shot.damage);
        if (this.time.now - this.lastCombatSound > 150) {
          this.lastCombatSound = this.time.now;
          this.playTone(390 + Math.random() * 150, 0.045, 'triangle');
        }
        shot.x = -100;
      } else {
        shot.x += (shot.target.x - shot.x) / distance * step;
        shot.y += (shot.target.y - shot.y) / distance * step;
      }
    }
    this.shots = this.shots.filter((shot) => shot.x >= 0);

    for (const ally of this.allies) {
      ally.life -= delta;
      const target = this.enemies.filter((enemy) => !enemy.escaped
        && Phaser.Math.Distance.Between(ally.x, ally.y, enemy.x, enemy.y) < 34)
        .sort((a, b) => b.pathIndex - a.pathIndex)[0];
      if (target) this.damageEnemy(target, 42 * delta);
    }
    this.allies = this.allies.filter((ally) => ally.life > 0);

    this.enemies = this.enemies.filter((enemy) => !enemy.escaped);
    useGameStore.getState().setCanCallEarly(
      state.waveActive && this.enemies.length > 0 && state.wave < 20,
    );
    if (state.waveActive && this.waveQueue.length === 0 && this.enemies.length === 0) {
      const wave = state.wave;
      useGameStore.getState().setWave(wave, false);
      if (wave === 20) useGameStore.getState().setPhase('won');
      else {
        useGameStore.getState().setGold(useGameStore.getState().gold + 45 + wave * 4);
        useGameStore.getState().showMessage(`第 ${wave} 波成功！獎勵 +${45 + wave * 4} 金幣`, 3000);
      }
    }
    this.renderScene(delta);
  }

  private renderScene(_delta: number) {
    const g = this.art;
    g.clear();
    const state = useGameStore.getState();
    for (const slot of state.slots) {
      const selected = state.selectedSlot === slot.id;
      if (selected) {
        const range = slot.tower ? TOWERS[slot.tower.kind].range + (slot.tower.level - 1) * 13 : 145;
        g.fillStyle(0xf8e7a5, 0.08);
        g.fillCircle(slot.x, slot.y, range);
        g.lineStyle(1.5, 0xf8e7a5, 0.5);
        g.strokeCircle(slot.x, slot.y, range);
      }
      g.fillStyle(0x18261c, 0.24);
      g.fillEllipse(slot.x, slot.y + 13, 47, 21);
      if (slot.tower) this.drawTower(g, slot.x, slot.y, slot.tower.kind, slot.tower.level, selected);
      else {
        g.fillStyle(selected ? 0xf3dc98 : 0xdbc88d, selected ? 0.85 : 0.64);
        g.fillCircle(slot.x, slot.y, selected ? 19 : 15);
        g.fillStyle(0x5b7148, 0.75);
        g.fillCircle(slot.x, slot.y, selected ? 13 : 10);
        g.lineStyle(2, 0xe7d59e, 0.75);
        g.strokeCircle(slot.x, slot.y, selected ? 19 : 15);
        g.fillStyle(0xf5ebca, 0.95);
        g.fillRect(slot.x - 1, slot.y - 6, 2, 12);
        g.fillRect(slot.x - 6, slot.y - 1, 12, 2);
      }
    }

    this.drawHero(g);
    for (const ally of this.allies) this.drawPerson(g, ally.x, ally.y, 0x68cbd0, 0.85, 8);
    for (const enemy of this.enemies) this.drawEnemy(g, enemy);
    for (const shot of this.shots) {
      g.fillStyle(shot.color, 0.28);
      g.fillCircle(shot.x, shot.y, 8);
      g.fillStyle(shot.color, 1);
      g.fillCircle(shot.x, shot.y, 4);
    }
    if (this.meteorEffect > 0) {
      const alpha = this.meteorEffect;
      g.fillStyle(0xff923f, alpha * 0.13);
      g.fillCircle(this.meteorX, this.meteorY, (1 - alpha) * 135 + 15);
      g.fillStyle(0xffb350, alpha);
      g.fillCircle(this.meteorX, this.meteorY, (1 - alpha) * 36 + 8);
      g.fillStyle(0xfff1bc, alpha);
      g.fillCircle(this.meteorX, this.meteorY, (1 - alpha) * 17 + 3);
    }
    const toast = state.message && Date.now() < state.messageUntil ? state.message : '';
    if (toast) {
      g.fillStyle(0x19271d, 0.88);
      g.fillRoundedRect(315, 49, 330, 39, 18);
      g.lineStyle(1.5, 0xe3c779, 0.75);
      g.strokeRoundedRect(315, 49, 330, 39, 18);
      g.fillStyle(0xffefc6, 1);
      g.fillRoundedRect(330, 61, 0, 0, 0);
      this.drawToastText(toast);
    }
  }

  private drawToastText(text: string) {
    this.toastLabel.setText(text);
    this.toastLabel.setVisible(true);
    this.toastLabel.setPosition(480, 68);
  }

  private drawTower(g: Phaser.GameObjects.Graphics, x: number, y: number, kind: TowerKind, level: number, selected: boolean) {
    const color = TOWERS[kind].color;
    g.fillStyle(0x624a37);
    g.fillRoundedRect(x - 19, y - 8, 38, 29, 7);
    g.fillStyle(0x9b8052);
    g.fillEllipse(x, y + 11, 42, 13);
    g.fillStyle(kind === 'mage' ? 0x554171 : kind === 'cannon' ? 0x55514b : kind === 'barracks' ? 0x46656b : 0x526c44);
    g.fillRoundedRect(x - 15, y - 24, 30, 34, 8);
    g.fillStyle(color, 1);
    if (kind === 'archer') {
      g.fillTriangle(x - 17, y - 21, x, y - 42 - level * 2, x + 17, y - 21);
      g.fillStyle(0x594a35);
      g.fillRect(x - 1, y - 24, 3, 17);
    } else if (kind === 'mage') {
      g.fillTriangle(x - 15, y - 22, x, y - 48 - level * 2, x + 15, y - 22);
      g.fillStyle(0xffe6a3, 0.9);
      g.fillCircle(x, y - 25, 5 + Math.sin(this.ambient * 4) * 1.2);
    } else if (kind === 'cannon') {
      g.fillRoundedRect(x - 19, y - 34, 38, 16, 5);
      g.fillStyle(0x363a37);
      g.fillCircle(x, y - 27, 7);
      g.fillStyle(0xc0ad8e);
      g.fillCircle(x - 11, y + 7, 5);
      g.fillCircle(x + 11, y + 7, 5);
    } else {
      g.fillTriangle(x - 17, y - 21, x, y - 39 - level, x + 17, y - 21);
      g.fillStyle(0xffe5a5);
      g.fillCircle(x, y - 23, 4);
    }
    g.lineStyle(2, 0xf8e4ae, selected ? 1 : 0.5);
    g.strokeRoundedRect(x - 20, y - 9, 40, 31, 8);
    for (let i = 0; i < level; i++) {
      g.fillStyle(0xffdb72, 1);
      g.fillCircle(x - (level - 1) * 5 + i * 10, y + 27, 2.5);
    }
  }

  private drawHero(g: Phaser.GameObjects.Graphics) {
    const bob = Math.sin(this.ambient * 8) * 1.4;
    g.fillStyle(0x15251d, 0.25);
    g.fillEllipse(this.hero.x, this.hero.y + 13, 29, 12);
    this.drawPerson(g, this.hero.x, this.hero.y + bob, 0xe1b754, 1, 11);
    g.fillStyle(0xc6d8d1);
    g.fillRoundedRect(this.hero.x - 8, this.hero.y - 5 + bob, 16, 13, 4);
    g.fillStyle(0x426e4a);
    g.fillRoundedRect(this.hero.x - 10, this.hero.y - 13 + bob, 20, 7, 4);
    g.fillStyle(0xe4c378);
    g.fillCircle(this.hero.x, this.hero.y - 8 + bob, 6);
    g.fillStyle(0xf5dc9e);
    g.fillTriangle(this.hero.x + 7, this.hero.y - 10 + bob, this.hero.x + 18, this.hero.y - 2 + bob, this.hero.x + 5, this.hero.y - 3 + bob);
  }

  private drawPerson(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha: number, size: number) {
    g.fillStyle(0x17251d, alpha * 0.24);
    g.fillEllipse(x, y + size * 0.9, size * 2.1, size * 0.7);
    g.fillStyle(color, alpha);
    g.fillRoundedRect(x - size * 0.55, y - size * 0.2, size * 1.1, size * 1.15, size * 0.35);
    g.fillStyle(0xd6ae7c, alpha);
    g.fillCircle(x, y - size * 0.48, size * 0.48);
    g.fillStyle(0x302c28, alpha);
    g.fillCircle(x + size * 0.18, y - size * 0.5, Math.max(1.2, size * 0.08));
  }

  private drawEnemy(g: Phaser.GameObjects.Graphics, enemy: Enemy) {
    const info = ENEMIES[enemy.kind];
    const bounce = Math.sin(this.ambient * (enemy.kind === 'wolf' ? 15 : 9) + enemy.x) * 1.5;
    if (enemy.kind === 'demon') {
      g.fillStyle(0x5b3468, 0.85);
      g.fillTriangle(enemy.x - 7, enemy.y - 3, enemy.x - 22, enemy.y - 15 + bounce, enemy.x - 12, enemy.y + 7);
      g.fillTriangle(enemy.x + 7, enemy.y - 3, enemy.x + 22, enemy.y - 15 - bounce, enemy.x + 12, enemy.y + 7);
    }
    if (enemy.kind === 'wolf') {
      g.fillStyle(0x647281);
      g.fillEllipse(enemy.x - 1, enemy.y + 1 + bounce, 27, 13);
      g.fillCircle(enemy.x + 9, enemy.y - 3 + bounce, 7);
      g.fillStyle(0xc27f55);
      g.fillCircle(enemy.x - 4, enemy.y - 7 + bounce, 5);
      g.fillStyle(0xe1d1b3);
      g.fillCircle(enemy.x + 12, enemy.y - 4 + bounce, 1.2);
    } else {
      g.fillStyle(info.color, 1);
      g.fillRoundedRect(enemy.x - enemy.radius * 0.72, enemy.y - enemy.radius * 0.15 + bounce, enemy.radius * 1.44, enemy.radius * 1.25, 5);
      g.fillCircle(enemy.x, enemy.y - enemy.radius * 0.38 + bounce, enemy.radius * 0.64);
      if (enemy.kind === 'boss') {
        g.fillStyle(0x582e36);
        g.fillTriangle(enemy.x - 15, enemy.y - 17 + bounce, enemy.x - 12, enemy.y - 31 + bounce, enemy.x - 3, enemy.y - 14 + bounce);
        g.fillTriangle(enemy.x + 15, enemy.y - 17 + bounce, enemy.x + 12, enemy.y - 31 + bounce, enemy.x + 3, enemy.y - 14 + bounce);
      } else if (enemy.kind === 'knight') {
        g.fillStyle(0xd4c8ad);
        g.fillRoundedRect(enemy.x - 10, enemy.y - 14 + bounce, 20, 9, 4);
        g.fillStyle(0x39464a);
        g.fillRect(enemy.x + 1, enemy.y - 11 + bounce, 6, 2);
      } else if (enemy.kind === 'goblin') {
        g.fillStyle(0x87bd56);
        g.fillTriangle(enemy.x - 7, enemy.y - 12 + bounce, enemy.x - 14, enemy.y - 22 + bounce, enemy.x - 3, enemy.y - 15 + bounce);
        g.fillTriangle(enemy.x + 7, enemy.y - 12 + bounce, enemy.x + 14, enemy.y - 22 + bounce, enemy.x + 3, enemy.y - 15 + bounce);
      } else {
        g.fillStyle(0xf0d4a9);
        g.fillTriangle(enemy.x + 8, enemy.y - 7 + bounce, enemy.x + 17, enemy.y - 4 + bounce, enemy.x + 8, enemy.y - 1 + bounce);
      }
      g.fillStyle(0x2d2925);
      g.fillCircle(enemy.x + 3, enemy.y - enemy.radius * 0.42 + bounce, enemy.kind === 'boss' ? 2 : 1.4);
    }
    g.fillStyle(0x1c241f, 0.85);
    g.fillRoundedRect(enemy.x - enemy.radius - 3, enemy.y - enemy.radius - 13, enemy.radius * 2 + 6, 4, 2);
    const ratio = Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
    g.fillStyle(ratio > 0.55 ? 0x8dd16a : ratio > 0.25 ? 0xf0bf54 : 0xe56c5c);
    g.fillRoundedRect(enemy.x - enemy.radius - 2, enemy.y - enemy.radius - 12, (enemy.radius * 2 + 4) * ratio, 2.5, 1);
  }
}
