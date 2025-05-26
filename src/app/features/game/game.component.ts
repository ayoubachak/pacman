import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { GameService } from '../../shared/services/game.service';
import { SettingsService } from '../../shared/services/settings.service';
import { CellType, Direction, GameState, Ghost, GhostState, Player, Theme } from '../../shared/models/game.models';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) gameCanvas!: ElementRef<HTMLCanvasElement>;
  
  private ctx!: CanvasRenderingContext2D;
  private readonly CELL_SIZE = 20;
  private readonly GAME_WIDTH = 20 * this.CELL_SIZE; // 20 cells width
  private readonly GAME_HEIGHT = 30 * this.CELL_SIZE; // 30 cells height
  private gameState: GameState | null = null;
  private currentTheme!: Theme;
  private destroyed$ = new Subject<void>();
  
  isPaused = false;
  isGameOver = false;
  score = 0;
  lives = 3;
  level = 1;
  
  // Add a new property to track level transition
  private isLevelTransitioning = false;
  
  constructor(
    private gameService: GameService,
    private settingsService: SettingsService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    const canvas = this.gameCanvas.nativeElement;
    canvas.width = this.GAME_WIDTH;
    canvas.height = this.GAME_HEIGHT;
    
    this.ctx = canvas.getContext('2d')!;
    
    // Subscribe to game state
    this.gameService.gameState$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(state => {
        this.gameState = state;
        if (state) {
          this.isPaused = state.paused;
          this.isGameOver = state.gameOver;
          this.score = state.player.score;
          this.lives = state.player.lives;
          this.level = state.level.id;
          this.renderGame();
        }
      });
    
    // Subscribe to theme changes
    this.gameService.currentTheme$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(theme => {
        this.currentTheme = theme;
      });
    
    // Subscribe to game over
    this.gameService.gameOver$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(finalScore => {
        this.isGameOver = true;
        // Could show game over screen, save high score, etc.
      });
    
    // Subscribe to level completed
    this.gameService.levelCompleted$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(levelId => {
        // Prevent multiple transitions
        if (this.isLevelTransitioning) return;
        
        this.isLevelTransitioning = true;
        
        // Show level completed overlay
        this.drawLevelCompletedOverlay();
        
        // Advance to next level after delay
        setTimeout(() => {
          this.isLevelTransitioning = false;
          this.gameService.startGame(levelId + 1);
        }, 2000);
      });
    
    // Start the game
    this.gameService.startGame(1);
  }
  
  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }
  
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    // Handle pause with Escape key
    if (event.key === 'Escape') {
      this.togglePause();
      return;
    }
    
    this.gameService.handleKeyPress(event);
  }
  
  togglePause(): void {
    this.gameService.pauseGame();
  }
  
  restartGame(): void {
    this.gameService.restartGame();
  }
  
  goToMainMenu(): void {
    this.router.navigate(['/menu']);
  }
  
  private renderGame(): void {
    if (!this.gameState || !this.ctx) return;
    
    // Clear the canvas
    this.ctx.fillStyle = this.currentTheme.backgroundColor;
    this.ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
    
    // Draw the maze
    this.drawMaze();
    
    // Draw the player
    this.drawPlayer();
    
    // Draw the ghosts
    this.drawGhosts();
    
    // Draw UI elements (score, lives, etc.)
    this.drawUI();
    
    // Draw pause/game over overlays if needed
    if (this.isPaused) {
      this.drawPauseOverlay();
    } else if (this.isGameOver) {
      this.drawGameOverOverlay();
    }
  }
  
  private drawMaze(): void {
    if (!this.gameState) return;
    
    const grid = this.gameState.level.grid;
    
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const cell = grid[y][x];
        const cellX = x * this.CELL_SIZE;
        const cellY = y * this.CELL_SIZE;
        
        switch (cell) {
          case CellType.WALL:
            this.ctx.fillStyle = this.currentTheme.wallColor;
            this.ctx.fillRect(cellX, cellY, this.CELL_SIZE, this.CELL_SIZE);
            break;
            
          case CellType.DOT:
            this.ctx.fillStyle = this.currentTheme.dotColor;
            this.ctx.beginPath();
            this.ctx.arc(
              cellX + this.CELL_SIZE / 2,
              cellY + this.CELL_SIZE / 2,
              this.CELL_SIZE / 10,
              0,
              Math.PI * 2
            );
            this.ctx.fill();
            break;
            
          case CellType.POWER_PELLET:
            this.ctx.fillStyle = this.currentTheme.powerPelletColor;
            this.ctx.beginPath();
            this.ctx.arc(
              cellX + this.CELL_SIZE / 2,
              cellY + this.CELL_SIZE / 2,
              this.CELL_SIZE / 4,
              0,
              Math.PI * 2
            );
            this.ctx.fill();
            break;
        }
      }
    }
  }
  
  private drawPlayer(): void {
    if (!this.gameState) return;
    
    const player = this.gameState.player;
    const x = player.position.x * this.CELL_SIZE + this.CELL_SIZE / 2;
    const y = player.position.y * this.CELL_SIZE + this.CELL_SIZE / 2;
    const radius = this.CELL_SIZE / 2;
    
    // Draw Pacman as a circle with a mouth
    this.ctx.fillStyle = this.currentTheme.playerColor;
    this.ctx.beginPath();
    
    // Calculate mouth angle based on direction
    let startAngle = 0.2 * Math.PI;
    let endAngle = 1.8 * Math.PI;
    
    switch (player.direction) {
      case Direction.RIGHT:
        startAngle = 0.2 * Math.PI;
        endAngle = 1.8 * Math.PI;
        break;
      case Direction.DOWN:
        startAngle = 0.7 * Math.PI;
        endAngle = 2.3 * Math.PI;
        break;
      case Direction.LEFT:
        startAngle = 1.2 * Math.PI;
        endAngle = 0.8 * Math.PI;
        break;
      case Direction.UP:
        startAngle = 1.7 * Math.PI;
        endAngle = 1.3 * Math.PI;
        break;
    }
    
    this.ctx.arc(x, y, radius * 0.8, startAngle, endAngle);
    this.ctx.lineTo(x, y);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  private drawGhosts(): void {
    if (!this.gameState) return;
    
    this.gameState.ghosts.forEach(ghost => {
      const x = ghost.position.x * this.CELL_SIZE;
      const y = ghost.position.y * this.CELL_SIZE;
      
      // Choose color based on ghost state
      let color;
      if (ghost.state === GhostState.FRIGHTENED) {
        color = this.currentTheme.frightenedGhostColor;
      } else if (ghost.state === GhostState.EATEN) {
        color = '#ffffff'; // Eyes only
      } else {
        color = this.currentTheme.ghostColors[ghost.type];
      }
      
      // Draw ghost body
      this.ctx.fillStyle = color;
      
      // Draw semi-circle for top of ghost
      this.ctx.beginPath();
      this.ctx.arc(
        x + this.CELL_SIZE / 2,
        y + this.CELL_SIZE / 2,
        this.CELL_SIZE / 2,
        Math.PI,
        0
      );
      
      // Draw wavy bottom
      this.ctx.lineTo(x + this.CELL_SIZE, y + this.CELL_SIZE);
      
      // Draw waves on bottom
      for (let i = 0; i < 3; i++) {
        const waveX = x + this.CELL_SIZE - (i * this.CELL_SIZE / 3);
        this.ctx.lineTo(waveX, y + this.CELL_SIZE - this.CELL_SIZE / 4);
        this.ctx.lineTo(waveX - this.CELL_SIZE / 6, y + this.CELL_SIZE);
      }
      
      this.ctx.lineTo(x, y + this.CELL_SIZE / 2);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Draw eyes (white part)
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(
        x + this.CELL_SIZE / 3,
        y + this.CELL_SIZE / 2,
        this.CELL_SIZE / 6,
        0,
        Math.PI * 2
      );
      this.ctx.arc(
        x + (this.CELL_SIZE * 2) / 3,
        y + this.CELL_SIZE / 2,
        this.CELL_SIZE / 6,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
      
      // Draw pupils (adjust based on direction)
      this.ctx.fillStyle = '#000000';
      
      // Position for pupils based on ghost direction
      let pupilOffsetX = 0;
      let pupilOffsetY = 0;
      
      switch (ghost.direction) {
        case Direction.UP:
          pupilOffsetY = -this.CELL_SIZE / 12;
          break;
        case Direction.RIGHT:
          pupilOffsetX = this.CELL_SIZE / 12;
          break;
        case Direction.DOWN:
          pupilOffsetY = this.CELL_SIZE / 12;
          break;
        case Direction.LEFT:
          pupilOffsetX = -this.CELL_SIZE / 12;
          break;
      }
      
      this.ctx.beginPath();
      this.ctx.arc(
        x + this.CELL_SIZE / 3 + pupilOffsetX,
        y + this.CELL_SIZE / 2 + pupilOffsetY,
        this.CELL_SIZE / 10,
        0,
        Math.PI * 2
      );
      this.ctx.arc(
        x + (this.CELL_SIZE * 2) / 3 + pupilOffsetX,
        y + this.CELL_SIZE / 2 + pupilOffsetY,
        this.CELL_SIZE / 10,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    });
  }
  
  private drawUI(): void {
    // We're removing the score display since it's already shown in the header
    // Only keep the level info if needed for debugging
    
    // If you want to keep some information for debugging, uncomment below:
    // this.ctx.fillStyle = '#ffffff';
    // this.ctx.font = '16px Arial';
    // this.ctx.textAlign = 'left';
    // this.ctx.fillText(`Level: ${this.level}`, 10, 20);
  }
  
  private drawPauseOverlay(): void {
    // Semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
    
    // Pause text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('PAUSED', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2);
    this.ctx.font = '16px Arial';
    this.ctx.fillText('Press ESC to resume', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 30);
  }
  
  private drawGameOverOverlay(): void {
    // Semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
    
    // Game Over text
    this.ctx.fillStyle = '#ff0000';
    this.ctx.font = 'bold 28px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 - 20);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px Arial';
    this.ctx.fillText(`Final Score: ${this.score}`, this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 20);
    
    this.ctx.font = '16px Arial';
    this.ctx.fillText('Click to restart', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 60);
  }
  
  // Add new method to draw level completed overlay
  private drawLevelCompletedOverlay(): void {
    if (!this.ctx) return;
    
    // Semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
    
    // Level completed text
    this.ctx.fillStyle = '#00ff00';
    this.ctx.font = 'bold 28px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('LEVEL COMPLETED!', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 - 20);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px Arial';
    this.ctx.fillText(`Score: ${this.score}`, this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 20);
    
    this.ctx.font = '16px Arial';
    this.ctx.fillText('Loading next level...', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 60);
  }
} 