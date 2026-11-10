import { create } from 'zustand';
import type { GameSnapshot, SlotState, TowerKind } from './types';

const initialSlots = (): SlotState[] => [
  { id: 0, x: 210, y: 145, tower: null },
  { id: 1, x: 370, y: 125, tower: null },
  { id: 2, x: 535, y: 145, tower: null },
  { id: 3, x: 735, y: 145, tower: null },
  { id: 4, x: 280, y: 270, tower: null },
  { id: 5, x: 455, y: 275, tower: null },
  { id: 6, x: 635, y: 275, tower: null },
  { id: 7, x: 820, y: 300, tower: null },
  { id: 8, x: 175, y: 425, tower: null },
  { id: 9, x: 370, y: 440, tower: null },
  { id: 10, x: 585, y: 435, tower: null },
  { id: 11, x: 770, y: 440, tower: null },
];

const readBest = () => {
  try {
    return Number(localStorage.getItem('kingdom-defender-best') || 0);
  } catch {
    return 0;
  }
};

const defaults = (): GameSnapshot => ({
  phase: 'menu',
  lives: 20,
  gold: 250,
  wave: 0,
  waveActive: false,
  canCallEarly: false,
  speed: 1,
  selectedSlot: null,
  slots: initialSlots(),
  meteorCooldown: 0,
  reinforcementsCooldown: 0,
  message: '',
  messageUntil: 0,
  bestWave: readBest(),
});

interface GameStore extends GameSnapshot {
  start: () => void;
  setPhase: (phase: GameSnapshot['phase']) => void;
  setSpeed: (speed: 1 | 2) => void;
  selectSlot: (id: number | null) => void;
  buildTower: (kind: TowerKind) => boolean;
  upgradeTower: () => boolean;
  sellTower: () => void;
  updateSlotTower: (id: number, tower: SlotState['tower']) => void;
  setGold: (gold: number) => void;
  setLives: (lives: number) => void;
  setWave: (wave: number, active: boolean) => void;
  setCanCallEarly: (canCallEarly: boolean) => void;
  setCooldown: (skill: 'meteor' | 'reinforcements', value: number) => void;
  showMessage: (message: string, duration?: number) => void;
}

const towerPrices: Record<TowerKind, number> = {
  archer: 70,
  mage: 90,
  cannon: 100,
  barracks: 80,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...defaults(),
  start: () => {
    const bestWave = get().bestWave;
    set({ ...defaults(), phase: 'playing', bestWave });
  },
  setPhase: (phase) => set({ phase }),
  setSpeed: (speed) => set({ speed }),
  selectSlot: (selectedSlot) => set({ selectedSlot }),
  buildTower: (kind) => {
    const { selectedSlot, gold, slots } = get();
    const slot = slots.find((entry) => entry.id === selectedSlot);
    if (!slot || slot.tower || gold < towerPrices[kind]) return false;
    set({
      gold: gold - towerPrices[kind],
      slots: slots.map((entry) => entry.id === selectedSlot ? { ...entry, tower: { kind, level: 1 } } : entry),
    });
    return true;
  },
  upgradeTower: () => {
    const { selectedSlot, slots, gold } = get();
    const slot = slots.find((entry) => entry.id === selectedSlot);
    if (!slot?.tower || slot.tower.level >= 3) return false;
    const price = slot.tower.level * 65;
    if (gold < price) return false;
    set({
      gold: gold - price,
      slots: slots.map((entry) => entry.id === selectedSlot && entry.tower
        ? { ...entry, tower: { ...entry.tower, level: entry.tower.level + 1 } }
        : entry),
    });
    return true;
  },
  sellTower: () => {
    const { selectedSlot, slots, gold } = get();
    const slot = slots.find((entry) => entry.id === selectedSlot);
    if (!slot?.tower) return;
    const spent = towerPrices[slot.tower.kind]
      + (slot.tower.level >= 2 ? 65 : 0)
      + (slot.tower.level >= 3 ? 130 : 0);
    const refund = Math.floor(spent * 0.6);
    set({
      gold: gold + refund,
      slots: slots.map((entry) => entry.id === selectedSlot ? { ...entry, tower: null } : entry),
    });
  },
  updateSlotTower: (id, tower) => set((state) => ({
    slots: state.slots.map((entry) => entry.id === id ? { ...entry, tower } : entry),
  })),
  setGold: (gold) => set({ gold: Math.max(0, gold) }),
  setLives: (lives) => set({ lives: Math.max(0, lives) }),
  setWave: (wave, waveActive) => {
    const bestWave = Math.max(get().bestWave, wave);
    try {
      localStorage.setItem('kingdom-defender-best', String(bestWave));
    } catch (error) {
      console.warn('無法儲存最佳波次：', error);
    }
    set({ wave, waveActive, bestWave, canCallEarly: false });
  },
  setCanCallEarly: (canCallEarly) => {
    if (get().canCallEarly !== canCallEarly) set({ canCallEarly });
  },
  setCooldown: (skill, value) => set(skill === 'meteor'
    ? { meteorCooldown: Math.max(0, value) }
    : { reinforcementsCooldown: Math.max(0, value) }),
  showMessage: (message, duration = 1800) => set({ message, messageUntil: Date.now() + duration }),
}));

export const TOWER_INFO: Record<TowerKind, { name: string; icon: string; color: string; description: string }> = {
  archer: { name: '弓箭塔', icon: '🏹', color: '#b7df73', description: '快速遠距離攻擊' },
  mage: { name: '法師塔', icon: '🔮', color: '#bd8bff', description: '魔法穿透護甲' },
  cannon: { name: '砲塔', icon: '💣', color: '#ff9e59', description: '範圍爆炸傷害' },
  barracks: { name: '兵營', icon: '🛡️', color: '#70c8d6', description: '派出士兵阻擋敵人' },
};

export const TOWER_COST: Record<TowerKind, number> = { archer: 70, mage: 90, cannon: 100, barracks: 80 };
