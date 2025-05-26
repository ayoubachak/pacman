import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { 
  CellType, Direction, GameState, Ghost, GhostState, 
  GhostType, Level, Player, Position, Theme 
} from '../models/game.models';
import { LEVELS } from '../models/levels.data';
import { THEMES } from '../models/themes.data';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private readonly CELL_SIZE = 20;
  private readonly GAME_SPEED = 150; // ms per frame
  private readonly POWER_PELLET_DURATION = 10000; // 10 seconds
  private readonly GHOST_SPEED_NORMAL = 150; // ms per move
  private readonly GHOST_SPEED_FRIGHTENED = 300; // ms per move
  
  private gameLoopInterval: any;
  private gameState = new BehaviorSubject<GameState | null>(null);
  private currentTheme = new BehaviorSubject<Theme>(THEMES[0]);
  private gameOver = new Subject<number>(); // Emits final score
  private levelCompleted = new Subject<number>(); // Emits level number

  constructor(private ngZone: NgZone) {}

  get gameState$(): Observable<GameState | null> {
    return this.gameState.asObservable();
  }

  get currentTheme$(): Observable<Theme> {
    return this.currentTheme.asObservable();
  }

  get gameOver$(): Observable<number> {
    return this.gameOver.asObservable();
  }

  get levelCompleted$(): Observable<number> {
    return this.levelCompleted.asObservable();
  }

  setTheme(themeId: string): void {
    const theme = THEMES.find(t => t.id === themeId);
    if (theme) {
      this.currentTheme.next(theme);
    }
  }

  startGame(levelId: number = 1): void {
    // Get the selected level or default to first level
    let level = LEVELS.find(l => l.id === levelId);
    
    // If level not found, check if we've completed all levels
    if (!level) {
      if (levelId > LEVELS.length) {
        // All levels completed, go back to level 1
        level = LEVELS[0];
      } else {
        // Invalid level ID, use first level
        level = LEVELS[0];
      }
    }
    
    // Create a deep copy of the level to avoid modifying the original
    const levelCopy = JSON.parse(JSON.stringify(level));
    
    this.initializeGame(levelCopy);
    this.startGameLoop();
  }

  pauseGame(): void {
    if (this.gameState.value) {
      const currentState = this.gameState.value;
      this.gameState.next({
        ...currentState,
        paused: !currentState.paused
      });
      
      if (currentState.paused) {
        this.startGameLoop();
      } else {
        this.stopGameLoop();
      }
    }
  }

  restartGame(): void {
    const currentState = this.gameState.value;
    if (currentState) {
      this.initializeGame(currentState.level);
      this.startGameLoop();
    }
  }

  handleKeyPress(event: KeyboardEvent): void {
    const currentState = this.gameState.value;
    if (!currentState || currentState.paused || currentState.gameOver) return;

    const player = currentState.player;
    
    switch (event.key) {
      case 'ArrowUp':
        player.nextDirection = Direction.UP;
        break;
      case 'ArrowRight':
        player.nextDirection = Direction.RIGHT;
        break;
      case 'ArrowDown':
        player.nextDirection = Direction.DOWN;
        break;
      case 'ArrowLeft':
        player.nextDirection = Direction.LEFT;
        break;
    }

    this.gameState.next({
      ...currentState,
      player
    });
  }

  private initializeGame(level: Level): void {
    // Find player spawn position
    let playerPosition: Position = { x: 0, y: 0 };
    let ghostSpawnPositions: Position[] = [];
    
    for (let y = 0; y < level.grid.length; y++) {
      for (let x = 0; x < level.grid[y].length; x++) {
        if (level.grid[y][x] === CellType.PLAYER_SPAWN) {
          playerPosition = { x, y };
        } else if (level.grid[y][x] === CellType.GHOST_SPAWN) {
          ghostSpawnPositions.push({ x, y });
        }
      }
    }

    // Create ghosts
    const ghosts: Ghost[] = [
      {
        type: GhostType.BLINKY,
        position: { ...ghostSpawnPositions[0] },
        direction: Direction.LEFT,
        targetPosition: { x: 0, y: 0 },
        state: GhostState.NORMAL
      },
      {
        type: GhostType.PINKY,
        position: { ...ghostSpawnPositions[1] || ghostSpawnPositions[0] },
        direction: Direction.UP,
        targetPosition: { x: 0, y: 0 },
        state: GhostState.NORMAL
      },
      {
        type: GhostType.INKY,
        position: { ...ghostSpawnPositions[2] || ghostSpawnPositions[0] },
        direction: Direction.RIGHT,
        targetPosition: { x: 0, y: 0 },
        state: GhostState.NORMAL
      },
      {
        type: GhostType.CLYDE,
        position: { ...ghostSpawnPositions[3] || ghostSpawnPositions[0] },
        direction: Direction.DOWN,
        targetPosition: { x: 0, y: 0 },
        state: GhostState.NORMAL
      }
    ];

    // Create player
    const player: Player = {
      position: { ...playerPosition },
      direction: Direction.NONE,
      nextDirection: Direction.NONE,
      lives: 3,
      score: 0
    };

    // Initialize game state
    this.gameState.next({
      level,
      player,
      ghosts,
      dotsEaten: 0,
      powerPelletActive: false,
      powerPelletTimer: 0,
      paused: false,
      gameOver: false
    });
  }

  private startGameLoop(): void {
    this.stopGameLoop();
    
    this.ngZone.runOutsideAngular(() => {
      this.gameLoopInterval = setInterval(() => {
        this.updateGame();
      }, this.GAME_SPEED);
    });
  }

  private stopGameLoop(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
    }
  }

  private updateGame(): void {
    const currentState = this.gameState.value;
    if (!currentState || currentState.paused || currentState.gameOver) return;

    // Update player position
    this.updatePlayerPosition(currentState);
    
    // Update ghost positions
    this.updateGhostPositions(currentState);
    
    // Check collisions
    this.checkCollisions(currentState);
    
    // Update power pellet timer
    if (currentState.powerPelletActive) {
      currentState.powerPelletTimer -= this.GAME_SPEED;
      if (currentState.powerPelletTimer <= 0) {
        currentState.powerPelletActive = false;
        currentState.ghosts.forEach(ghost => {
          if (ghost.state === GhostState.FRIGHTENED) {
            ghost.state = GhostState.NORMAL;
          }
        });
      }
    }
    
    // Check win condition
    if (currentState.dotsEaten >= currentState.level.dotCount) {
      this.levelCompleted.next(currentState.level.id);
      this.stopGameLoop();
      return;
    }
    
    this.ngZone.run(() => {
      this.gameState.next({ ...currentState });
    });
  }

  private updatePlayerPosition(state: GameState): void {
    const player = state.player;
    const grid = state.level.grid;
    
    // Try to change direction if player wants to
    if (player.nextDirection !== Direction.NONE) {
      const nextPos = this.getNextPosition(player.position, player.nextDirection);
      if (this.isValidMove(nextPos, grid)) {
        player.direction = player.nextDirection;
      }
    }
    
    // Move in current direction
    if (player.direction !== Direction.NONE) {
      const nextPos = this.getNextPosition(player.position, player.direction);
      if (this.isValidMove(nextPos, grid)) {
        player.position = nextPos;
        
        // Check if player ate something
        const cell = grid[nextPos.y][nextPos.x];
        if (cell === CellType.DOT) {
          grid[nextPos.y][nextPos.x] = CellType.EMPTY;
          player.score += 10;
          state.dotsEaten++;
        } else if (cell === CellType.POWER_PELLET) {
          grid[nextPos.y][nextPos.x] = CellType.EMPTY;
          player.score += 50;
          state.dotsEaten++;
          state.powerPelletActive = true;
          state.powerPelletTimer = this.POWER_PELLET_DURATION;
          
          // Make ghosts frightened
          state.ghosts.forEach(ghost => {
            if (ghost.state !== GhostState.EATEN) {
              ghost.state = GhostState.FRIGHTENED;
            }
          });
        }
      }
    }
  }

  private updateGhostPositions(state: GameState): void {
    state.ghosts.forEach(ghost => {
      // Determine ghost behavior based on state
      if (ghost.state === GhostState.NORMAL) {
        this.updateGhostTargetPosition(ghost, state);
      } else if (ghost.state === GhostState.FRIGHTENED) {
        // Random movement when frightened
        ghost.targetPosition = this.getRandomPosition(state.level.grid);
      } else if (ghost.state === GhostState.EATEN) {
        // Go back to spawn when eaten
        // Find a ghost spawn position
        for (let y = 0; y < state.level.grid.length; y++) {
          for (let x = 0; x < state.level.grid[y].length; x++) {
            if (state.level.grid[y][x] === CellType.GHOST_SPAWN) {
              ghost.targetPosition = { x, y };
              break;
            }
          }
        }
      }
      
      // Move ghost towards target
      this.moveGhostTowardsTarget(ghost, state.level.grid);
    });
  }

  private updateGhostTargetPosition(ghost: Ghost, state: GameState): void {
    const player = state.player;
    
    switch (ghost.type) {
      case GhostType.BLINKY:
        // Blinky directly targets Pacman
        ghost.targetPosition = { ...player.position };
        break;
        
      case GhostType.PINKY:
        // Pinky targets 4 tiles ahead of Pacman
        const ahead = this.getNextPosition(player.position, player.direction, 4);
        ghost.targetPosition = ahead;
        break;
        
      case GhostType.INKY:
        // Inky has complex targeting - simplified here
        const twoAhead = this.getNextPosition(player.position, player.direction, 2);
        const blinky = state.ghosts.find(g => g.type === GhostType.BLINKY);
        if (blinky) {
          const vector = {
            x: twoAhead.x - blinky.position.x,
            y: twoAhead.y - blinky.position.y
          };
          ghost.targetPosition = {
            x: twoAhead.x + vector.x,
            y: twoAhead.y + vector.y
          };
        } else {
          ghost.targetPosition = { ...player.position };
        }
        break;
        
      case GhostType.CLYDE:
        // Clyde targets Pacman when far, runs away when close
        const distance = this.getDistance(ghost.position, player.position);
        if (distance > 8) {
          ghost.targetPosition = { ...player.position };
        } else {
          // Target the bottom-left corner when close
          ghost.targetPosition = { x: 0, y: state.level.grid.length - 1 };
        }
        break;
    }
  }

  private moveGhostTowardsTarget(ghost: Ghost, grid: CellType[][]): void {
    // Determine possible directions
    const possibleDirections: Direction[] = [];
    
    // Don't allow reversing direction
    const oppositeDirection = this.getOppositeDirection(ghost.direction);
    
    // Check each direction
    [Direction.UP, Direction.RIGHT, Direction.DOWN, Direction.LEFT].forEach(dir => {
      if (dir !== oppositeDirection) {
        const nextPos = this.getNextPosition(ghost.position, dir);
        if (this.isValidMove(nextPos, grid)) {
          possibleDirections.push(dir);
        }
      }
    });
    
    if (possibleDirections.length > 0) {
      // Choose direction closest to target
      let bestDirection = possibleDirections[0];
      let bestDistance = Number.MAX_VALUE;
      
      possibleDirections.forEach(dir => {
        const nextPos = this.getNextPosition(ghost.position, dir);
        const distance = this.getDistance(nextPos, ghost.targetPosition);
        
        if (distance < bestDistance) {
          bestDistance = distance;
          bestDirection = dir;
        }
      });
      
      ghost.direction = bestDirection;
      ghost.position = this.getNextPosition(ghost.position, ghost.direction);
    }
  }

  private checkCollisions(state: GameState): void {
    const player = state.player;
    
    state.ghosts.forEach(ghost => {
      if (this.arePositionsEqual(player.position, ghost.position)) {
        if (ghost.state === GhostState.FRIGHTENED) {
          // Player eats ghost
          ghost.state = GhostState.EATEN;
          player.score += 200;
        } else if (ghost.state === GhostState.NORMAL) {
          // Ghost catches player
          player.lives--;
          if (player.lives <= 0) {
            state.gameOver = true;
            this.gameOver.next(player.score);
            this.stopGameLoop();
          } else {
            // Reset positions
            this.resetPositions(state);
          }
        }
      }
    });
  }

  private resetPositions(state: GameState): void {
    // Find spawn positions
    let playerSpawn: Position | null = null;
    let ghostSpawns: Position[] = [];
    
    for (let y = 0; y < state.level.grid.length; y++) {
      for (let x = 0; x < state.level.grid[y].length; x++) {
        if (state.level.grid[y][x] === CellType.PLAYER_SPAWN) {
          playerSpawn = { x, y };
        } else if (state.level.grid[y][x] === CellType.GHOST_SPAWN) {
          ghostSpawns.push({ x, y });
        }
      }
    }
    
    if (playerSpawn) {
      state.player.position = { ...playerSpawn };
      state.player.direction = Direction.NONE;
      state.player.nextDirection = Direction.NONE;
    }
    
    state.ghosts.forEach((ghost, index) => {
      ghost.position = { ...ghostSpawns[index % ghostSpawns.length] };
      ghost.state = GhostState.NORMAL;
      ghost.direction = Direction.NONE;
    });
    
    state.powerPelletActive = false;
    state.powerPelletTimer = 0;
  }

  private isValidMove(position: Position, grid: CellType[][]): boolean {
    // Check if position is within grid bounds
    if (position.y < 0 || position.y >= grid.length || 
        position.x < 0 || position.x >= grid[position.y].length) {
      return false;
    }
    
    // Check if position is a wall
    return grid[position.y][position.x] !== CellType.WALL;
  }

  private getNextPosition(position: Position, direction: Direction, steps: number = 1): Position {
    const result = { ...position };
    
    switch (direction) {
      case Direction.UP:
        result.y -= steps;
        break;
      case Direction.RIGHT:
        result.x += steps;
        break;
      case Direction.DOWN:
        result.y += steps;
        break;
      case Direction.LEFT:
        result.x -= steps;
        break;
    }
    
    return result;
  }

  private getOppositeDirection(direction: Direction): Direction {
    switch (direction) {
      case Direction.UP:
        return Direction.DOWN;
      case Direction.RIGHT:
        return Direction.LEFT;
      case Direction.DOWN:
        return Direction.UP;
      case Direction.LEFT:
        return Direction.RIGHT;
      default:
        return Direction.NONE;
    }
  }

  private getDistance(posA: Position, posB: Position): number {
    return Math.sqrt(
      Math.pow(posB.x - posA.x, 2) + 
      Math.pow(posB.y - posA.y, 2)
    );
  }

  private arePositionsEqual(posA: Position, posB: Position): boolean {
    return posA.x === posB.x && posA.y === posB.y;
  }

  private getRandomPosition(grid: CellType[][]): Position {
    const height = grid.length;
    const width = grid[0].length;
    
    // Try to find a valid position
    for (let attempts = 0; attempts < 20; attempts++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      
      if (grid[y][x] !== CellType.WALL) {
        return { x, y };
      }
    }
    
    // Fallback to a corner
    return { x: 1, y: 1 };
  }
} 