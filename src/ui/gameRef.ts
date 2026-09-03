import type { Game } from '../game/Game';

let instance: Game | null = null;

export function setGame(g: Game | null) {
  instance = g;
}

export function getGame(): Game | null {
  return instance;
}
