import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { gameConfig } from './game/config';
import { TOWER_COST, TOWER_INFO, useGameStore } from './game/store';
import type { TowerKind } from './game/types';

const TOWERS: TowerKind[] = ['archer', 'mage', 'cannon', 'barracks'];

function emit(name: string) {
  window.dispatchEvent(new Event(name));
}

function formatTime(seconds: number) {
  return seconds > 0 ? `${Math.ceil(seconds)}s` : '就緒';
}

function App() {
  const game = useGameStore();
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!gameRef.current) gameRef.current = new Phaser.Game(gameConfig);
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  const selectedSlot = game.slots.find((slot) => slot.id === game.selectedSlot) ?? null;

  const start = () => {
    game.start();
    window.setTimeout(() => emit('start-wave'), 60);
  };

  const startWave = () => emit('start-wave');

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark">♜</span>
          <span><strong>王國守衛者</strong><small>KINGDOM DEFENDER</small></span>
        </a>
        <div className="topbar-note"><span className="live-dot" /> 翡翠森林・第七王國</div>
        <button className="sound-button" title="原創繪製的遊戲場景" aria-label="查看遊戲資訊">✦ <span>森林守衛戰</span></button>
      </header>

      <section className="game-shell">
        <div className="game-toolbar">
          <div className="stat-group">
            <div className="stat-pill lives"><span>♥</span><strong>{game.lives}</strong><small>城堡生命</small></div>
            <div className="stat-pill gold"><span>◈</span><strong>{game.gold}</strong><small>金幣</small></div>
            <div className="stat-pill wave-stat"><span>⚑</span><strong>{String(game.wave).padStart(2, '0')}<i>/20</i></strong><small>{game.waveActive ? '敵軍來襲' : '王國波次'}</small></div>
          </div>
          <div className="toolbar-actions">
            {game.phase === 'playing' && (
              <>
                <button className="tool-button" onClick={() => game.setPhase('paused')} title="暫停遊戲">Ⅱ 暫停</button>
                <button className={`tool-button speed ${game.speed === 2 ? 'active' : ''}`} onClick={() => game.setSpeed(game.speed === 1 ? 2 : 1)} title="切換遊戲速度">» {game.speed}×</button>
              </>
            )}
            {game.phase === 'paused' && <button className="tool-button resume" onClick={() => game.setPhase('playing')}>▶ 繼續</button>}
          </div>
        </div>

        <div className="stage-wrap">
          <div id="game-stage" className="game-stage" aria-label="翡翠森林塔防遊戲畫面" />

          {game.phase === 'menu' && (
            <div className="screen-cover menu-cover">
              <div className="menu-card">
                <div className="crest">♜</div>
                <div className="eyebrow">THE EMERALD KINGDOM</div>
                <h1>王國<span>守衛者</span></h1>
                <p className="english-title">KINGDOM DEFENDER</p>
                <div className="ornament"><i /> ✦ <i /></div>
                <p className="menu-copy">森林深處的魔物正朝城堡逼近。<br />建造防禦、集結英雄，守住王國最後的城門！</p>
                <button className="primary-button" onClick={start}>開始守衛 <span>→</span></button>
                <div className="menu-foot">20 波魔物 · 4 種防禦塔 · 1 位王國英雄</div>
              </div>
            </div>
          )}

          {game.phase === 'paused' && (
            <div className="screen-cover">
              <div className="result-card">
                <div className="result-icon">Ⅱ</div><div className="eyebrow">BATTLE PAUSED</div>
                <h2>戰局暫停</h2><p>王國暫時安全，準備好再繼續吧。</p>
                <button className="primary-button" onClick={() => game.setPhase('playing')}>▶ 繼續戰鬥</button>
              </div>
            </div>
          )}

          {(game.phase === 'won' || game.phase === 'lost') && (
            <div className="screen-cover">
              <div className="result-card">
                <div className="result-icon">{game.phase === 'won' ? '♛' : '🛡'}</div>
                <div className="eyebrow">{game.phase === 'won' ? 'VICTORY · THE KINGDOM IS SAFE' : 'DEFEAT · THE GATES HAVE FALLEN'}</div>
                <h2>{game.phase === 'won' ? '王國得救了！' : '城堡失守'}</h2>
                <p>{game.phase === 'won' ? '你擊退了森林魔王，成為王國的傳奇守護者。' : `你守到了第 ${game.wave} 波。下次一定能做得更好！`}</p>
                <div className="best-wave">最佳紀錄 <strong>第 {game.bestWave} 波</strong></div>
                <button className="primary-button" onClick={start}>再戰一次 <span>↻</span></button>
              </div>
            </div>
          )}

          {game.phase === 'playing' && (
            <>
              <div className="map-hint"><span className="hint-desktop">點擊空地移動英雄・點擊營地建造防禦</span><span className="hint-mobile">點擊移動英雄・點擊營地建造</span></div>
              <div className="skill-bar">
                <button className={`skill-button meteor ${game.meteorCooldown > 0 ? 'cooling' : ''}`} onClick={() => emit('cast-meteor')} disabled={game.meteorCooldown > 0} aria-label="施放流星火雨">
                  <span className="skill-icon">☄</span><span><b>流星火雨</b><small>{formatTime(game.meteorCooldown)}</small></span><kbd>Q</kbd>
                </button>
                <button className={`skill-button reinforcements ${game.reinforcementsCooldown > 0 ? 'cooling' : ''}`} onClick={() => emit('call-reinforcements')} disabled={game.reinforcementsCooldown > 0} aria-label="召喚王國援軍">
                  <span className="skill-icon">🛡</span><span><b>召喚援軍</b><small>{formatTime(game.reinforcementsCooldown)}</small></span><kbd>W</kbd>
                </button>
              </div>
              {!game.waveActive && game.wave < 20 && (
                <button className="wave-call-button" onClick={startWave}>
                  <span>⚑</span> {game.wave === 0 ? '召喚第 1 波' : `召喚第 ${game.wave + 1} 波`} <small>＋ 金幣獎勵</small>
                </button>
              )}
              {game.waveActive && <div className="wave-active-badge"><span className="pulse-dot" /> 第 {game.wave} 波進行中</div>}
              {game.canCallEarly && <button className="early-wave-button" onClick={() => emit('early-wave')}>⚑ 提前召喚第 {game.wave + 1} 波 <small>＋25 金幣</small></button>}
            </>
          )}

          {game.phase === 'playing' && selectedSlot && (
            <div className="build-panel">
              <button className="panel-close" aria-label="關閉建塔選單" onClick={() => game.selectSlot(null)}>×</button>
              {!selectedSlot.tower ? (
                <>
                  <div className="panel-heading"><span>✦</span><div><b>建造防禦塔</b><small>選擇守衛這處營地的防禦</small></div></div>
                  <div className="tower-options">
                    {TOWERS.map((kind) => {
                      const info = TOWER_INFO[kind];
                      const affordable = game.gold >= TOWER_COST[kind];
                      return <button key={kind} className={`tower-option ${affordable ? '' : 'unaffordable'}`} disabled={!affordable} onClick={() => game.buildTower(kind)}>
                        <span className="tower-icon" style={{ color: info.color }}>{info.icon}</span>
                        <span className="tower-copy"><b>{info.name}</b><small>{info.description}</small></span>
                        <span className="tower-price">◈ {TOWER_COST[kind]}</span>
                      </button>;
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="panel-heading"><span style={{ color: TOWER_INFO[selectedSlot.tower.kind].color }}>{TOWER_INFO[selectedSlot.tower.kind].icon}</span><div><b>{TOWER_INFO[selectedSlot.tower.kind].name} <em>Lv.{selectedSlot.tower.level}</em></b><small>{TOWER_INFO[selectedSlot.tower.kind].description}・範圍已顯示</small></div></div>
                  <div className="tower-manage">
                    {selectedSlot.tower.level < 3 && <button className="upgrade-button" onClick={() => game.upgradeTower()} disabled={game.gold < selectedSlot.tower.level * 65}>
                      ⬆ 升級至 Lv.{selectedSlot.tower.level + 1} <strong>◈ {selectedSlot.tower.level * 65}</strong>
                    </button>}
                    {selectedSlot.tower.level >= 3 && <div className="max-level">✦ 已達最高等級</div>}
                    <button className="sell-button" onClick={() => game.sellTower()}>出售防禦塔 <strong>＋60% 金幣</strong></button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <footer className="game-footer">
          <span><i className="footer-dot" /> 原創程式繪製・不含第三方美術素材</span>
          <span>第 {game.wave} / 20 波 <b>·</b> 最佳紀錄 {game.bestWave}</span>
        </footer>
      </section>
      <div className="page-caption">策略布局你的防線，守護翡翠王國的黎明。</div>
    </main>
  );
}

export default App;
