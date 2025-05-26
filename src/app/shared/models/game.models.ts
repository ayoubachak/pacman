export enum CellType {
  EMPTY = 0,
  WALL = 1,
  DOT = 2,
  POWER_PELLET = 3,
  GHOST_SPAWN = 4,
  PLAYER_SPAWN = 5
}

export enum Direction {
  UP,
  RIGHT,
  DOWN,
  LEFT,
  NONE
}

export enum GhostType {
  BLINKY, // Red - Shadow
  PINKY,  // Pink - Speedy
  INKY,   // Blue - Bashful
  CLYDE   // Orange - Pokey
}

export enum GhostState {
  NORMAL,
  FRIGHTENED,
  EATEN
}

export interface Position {
  x: number;
  y: number;
}

export interface Ghost {
  type: GhostType;
  position: Position;
  direction: Direction;
  targetPosition: Position;
  state: GhostState;
  frightenenedTimer?: number;
}

export interface Player {
  position: Position;
  direction: Direction;
  nextDirection: Direction;
  lives: number;
  score: number;
}

export interface Level {
  id: number;
  name: string;
  grid: CellType[][];
  dotCount: number;
}

export interface GameState {
  level: Level;
  player: Player;
  ghosts: Ghost[];
  dotsEaten: number;
  powerPelletActive: boolean;
  powerPelletTimer: number;
  paused: boolean;
  gameOver: boolean;
}

export interface Theme {
  id: string;
  name: string;
  wallColor: string;
  backgroundColor: string;
  dotColor: string;
  powerPelletColor: string;
  playerColor: string;
  ghostColors: Record<GhostType, string>;
  frightenedGhostColor: string;
} 