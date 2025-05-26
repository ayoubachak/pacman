import { GhostType, Theme } from './game.models';

export const THEMES: Theme[] = [
  {
    id: 'classic',
    name: 'Classic',
    wallColor: '#2121ff',
    backgroundColor: '#000',
    dotColor: '#ffb8ae',
    powerPelletColor: '#ffb8ae',
    playerColor: '#ffff00',
    ghostColors: {
      [GhostType.BLINKY]: '#ff0000',
      [GhostType.PINKY]: '#ffb8ff',
      [GhostType.INKY]: '#00ffff',
      [GhostType.CLYDE]: '#ffb852'
    },
    frightenedGhostColor: '#2121ff'
  },
  {
    id: 'neon',
    name: 'Neon',
    wallColor: '#00ff00',
    backgroundColor: '#111',
    dotColor: '#ff00ff',
    powerPelletColor: '#ff00ff',
    playerColor: '#ffff00',
    ghostColors: {
      [GhostType.BLINKY]: '#ff0000',
      [GhostType.PINKY]: '#ff00ff',
      [GhostType.INKY]: '#00ffff',
      [GhostType.CLYDE]: '#ff8c00'
    },
    frightenedGhostColor: '#0000ff'
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    wallColor: '#ffffff',
    backgroundColor: '#000000',
    dotColor: '#ffffff',
    powerPelletColor: '#ffffff',
    playerColor: '#ffffff',
    ghostColors: {
      [GhostType.BLINKY]: '#aaaaaa',
      [GhostType.PINKY]: '#cccccc',
      [GhostType.INKY]: '#888888',
      [GhostType.CLYDE]: '#dddddd'
    },
    frightenedGhostColor: '#444444'
  }
]; 