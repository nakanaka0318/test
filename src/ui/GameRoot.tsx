import { useEffect, useRef } from 'react';
import { Game } from '../game/Game';
import { useUiStore } from '../game/state';
import BuildOverlay from './BuildOverlay';
import Hud from './Hud';
import MainMenu from './MainMenu';
import PauseMenu from './PauseMenu';
import ResultScreen from './ResultScreen';
import { getGame, setGame } from './gameRef';

export default function GameRoot() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const phase = useUiStore((s) => s.phase);
  const buildMode = useUiStore((s) => s.buildMode);
  const pointerLocked = useUiStore((s) => s.pointerLocked);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const game = new Game(el);
    setGame(game);
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__game = game;
    }
    game.begin();
    return () => {
      game.dispose();
      setGame(null);
    };
  }, []);

  const inGame = phase === 'prep' || phase === 'wave';
  const needsLock = inGame && !buildMode && !pointerLocked;

  return (
    <div className="app">
      <div className="viewport" ref={viewportRef} />
      {inGame && <Hud />}
      {inGame && buildMode && <BuildOverlay />}
      {needsLock && (
        <div
          className="lock-prompt"
          onClick={() => getGame()?.input.requestLock()}
          role="presentation"
        >
          <div>
            クリックして操作を開始
            <br />
            <span style={{ opacity: 0.6, fontSize: 11 }}>マウスカーソルがロックされます</span>
          </div>
        </div>
      )}
      {phase === 'menu' && <MainMenu />}
      {phase === 'paused' && <PauseMenu />}
      {(phase === 'victory' || phase === 'defeat') && <ResultScreen />}
    </div>
  );
}
