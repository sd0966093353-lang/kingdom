export type TowerKind = 'archer' | 'mage' | 'cannon' | 'barracks';
export type EnemyKind = 'goblin' | 'orc' | 'wolf' | 'knight' | 'demon' | 'boss';
export type Phase = 'menu' | 'playing' | 'paused' | 'won' | 'lost';

export interface TowerState {
  kind: TowerKind;
  level: number;
}

export interface SlotState {
  id: number;
  x: number;
  y: number;
  tower: TowerState | null;
}

export interface GameSnapshot {
  phase: Phase;
  lives: number;
  gold: number;
  wave: number;
  waveActive: boolean;
  canCallEarly: boolean;
  speed: 1 | 2;
  selectedSlot: number | null;
  slots: SlotState[];
  meteorCooldown: number;
  reinforcementsCooldown: number;
  message: string;
  messageUntil: number;
  bestWave: number;
}
