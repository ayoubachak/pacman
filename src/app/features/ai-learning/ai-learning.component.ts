import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { GameService } from '../../shared/services/game.service';
import { AIAgentService } from '../../shared/services/ai-agent.service';
import { 
  GameState, Direction, CellType, GhostState, Theme 
} from '../../shared/models/game.models';
import { 
  TrainingMetrics, VisualizationData, AIMode 
} from '../../shared/models/ai.models';

@Component({
  selector: 'app-ai-learning',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './ai-learning.component.html',
  styleUrls: ['./ai-learning.component.css']
})
export class AILearningComponent implements OnInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) gameCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('networkCanvas', { static: true }) networkCanvas!: ElementRef<HTMLCanvasElement>;
  
  private ctx!: CanvasRenderingContext2D;
  private networkCtx!: CanvasRenderingContext2D;
  private readonly CELL_SIZE = 16; // Smaller for AI view
  private readonly GAME_WIDTH = 20 * this.CELL_SIZE;
  private readonly GAME_HEIGHT = 30 * this.CELL_SIZE;
  private readonly destroyed$ = new Subject<void>();
  
  gameState: GameState | null = null;
  trainingMetrics: TrainingMetrics | null = null;
  visualizationData: VisualizationData | null = null;
  currentTheme!: Theme;
  
  isTraining = false;
  trainingSpeed = 1; // 1x, 2x, 5x, 10x
  autoRestartEnabled = true;
  
  private gameLoopInterval: any;
  private previousGameState: GameState | null = null;

  constructor(
    private readonly gameService: GameService,
    private readonly aiAgent: AIAgentService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.setupCanvases();
    this.subscribeToServices();
    this.aiAgent.setMode(AIMode.TRAINING);
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
    this.stopTraining();
  }

  private setupCanvases(): void {
    // Game canvas
    const gameCanvas = this.gameCanvas.nativeElement;
    gameCanvas.width = this.GAME_WIDTH;
    gameCanvas.height = this.GAME_HEIGHT;
    this.ctx = gameCanvas.getContext('2d')!;

    // Network visualization canvas
    const networkCanvas = this.networkCanvas.nativeElement;
    networkCanvas.width = 400;
    networkCanvas.height = 300;
    this.networkCtx = networkCanvas.getContext('2d')!;
  }

  private subscribeToServices(): void {
    // Subscribe to game state
    this.gameService.gameState$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(state => {
        if (state) {
          this.handleGameStateUpdate(state);
        }
      });

    // Subscribe to theme
    this.gameService.currentTheme$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(theme => {
        this.currentTheme = theme;
      });

    // Subscribe to training metrics
    this.aiAgent.trainingMetrics$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(metrics => {
        this.trainingMetrics = metrics;
      });

    // Subscribe to visualization data
    this.aiAgent.visualizationData$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(data => {
        this.visualizationData = data;
        this.renderNetworkVisualization();
      });

    // Subscribe to game over
    this.gameService.gameOver$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        if (this.isTraining && this.autoRestartEnabled) {
          setTimeout(() => this.restartGame(), 1000);
        }
      });

    // Subscribe to level completed
    this.gameService.levelCompleted$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        if (this.isTraining && this.autoRestartEnabled) {
          setTimeout(() => this.restartGame(), 1000);
        }
      });
  }

  private handleGameStateUpdate(state: GameState): void {
    this.gameState = state;
    
    // Only process AI actions during training and avoid circular calls
    if (this.isTraining && !state.gameOver && !state.paused) {
      // Use a timeout to break the synchronous call chain and prevent stack overflow
      setTimeout(() => {
        this.processAITurn(state);
      }, 0);
    }
    
    this.renderGame();
  }

  private processAITurn(state: GameState): void {
    // Double-check we're still training and game is still active
    if (!this.isTraining || state.gameOver || state.paused) return;
    
    // Get AI action
    const aiAction = this.aiAgent.getAction(state);
    
    // Calculate reward and learn from previous state
    if (this.previousGameState) {
      const reward = this.aiAgent.calculateReward(
        this.previousGameState,
        state,
        aiAction.direction
      );
      this.aiAgent.learn(state, reward, state.gameOver);
    }
    
    // Store current state for next iteration
    this.previousGameState = JSON.parse(JSON.stringify(state));
    
    // Apply AI action to game
    const direction = this.convertAIActionToDirection(aiAction.direction);
    this.simulateKeyPress(direction);
  }

  private convertAIActionToDirection(action: number): Direction {
    switch (action) {
      case 0: return Direction.UP;
      case 1: return Direction.RIGHT;
      case 2: return Direction.DOWN;
      case 3: return Direction.LEFT;
      default: return Direction.NONE;
    }
  }

  private simulateKeyPress(direction: Direction): void {
    let key = '';
    switch (direction) {
      case Direction.UP: key = 'ArrowUp'; break;
      case Direction.RIGHT: key = 'ArrowRight'; break;
      case Direction.DOWN: key = 'ArrowDown'; break;
      case Direction.LEFT: key = 'ArrowLeft'; break;
      default: return;
    }
    
    const event = new KeyboardEvent('keydown', { key });
    this.gameService.handleKeyPress(event);
  }

  startTraining(): void {
    this.isTraining = true;
    this.aiAgent.setMode(AIMode.TRAINING);
    this.gameService.startGame(1);
    this.startGameLoop();
  }

  stopTraining(): void {
    this.isTraining = false;
    this.aiAgent.setMode(AIMode.INFERENCE);
    this.stopGameLoop();
  }

  pauseTraining(): void {
    if (this.isTraining) {
      this.gameService.pauseGame();
    }
  }

  restartGame(): void {
    this.aiAgent.reset();
    this.previousGameState = null;
    this.gameService.startGame(1);
  }

  setTrainingSpeed(speed: number): void {
    this.trainingSpeed = speed;
    if (this.isTraining) {
      this.stopGameLoop();
      this.startGameLoop();
    }
  }

  toggleAutoRestart(): void {
    this.autoRestartEnabled = !this.autoRestartEnabled;
  }

  saveModel(): void {
    const modelData = this.aiAgent.saveModel();
    const blob = new Blob([modelData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pacman-ai-model-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  loadModel(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const modelData = e.target?.result as string;
        this.aiAgent.loadModel(modelData);
      };
      reader.readAsText(file);
    }
  }

  goToMainMenu(): void {
    this.stopTraining();
    this.router.navigate(['/menu']);
  }

  private startGameLoop(): void {
    this.stopGameLoop();
    const interval = Math.max(50, 200 / this.trainingSpeed); // Faster training
    
    this.gameLoopInterval = setInterval(() => {
      // The game loop is handled by the game service
      // We just need to ensure the game keeps running
    }, interval);
  }

  private stopGameLoop(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }

  private renderGame(): void {
    if (!this.gameState || !this.ctx) return;

    // Clear canvas
    this.ctx.fillStyle = this.currentTheme.backgroundColor;
    this.ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

    // Draw maze
    this.drawMaze();
    
    // Draw player
    this.drawPlayer();
    
    // Draw ghosts
    this.drawGhosts();
    
    // Draw AI decision overlay
    this.drawAIOverlay();
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
              this.CELL_SIZE / 8,
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
    const radius = this.CELL_SIZE / 2.5;

    this.ctx.fillStyle = this.currentTheme.playerColor;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawGhosts(): void {
    if (!this.gameState) return;

    this.gameState.ghosts.forEach(ghost => {
      const x = ghost.position.x * this.CELL_SIZE + this.CELL_SIZE / 2;
      const y = ghost.position.y * this.CELL_SIZE + this.CELL_SIZE / 2;
      const radius = this.CELL_SIZE / 2.5;

      let color;
      if (ghost.state === GhostState.FRIGHTENED) {
        color = this.currentTheme.frightenedGhostColor;
      } else {
        color = this.currentTheme.ghostColors[ghost.type];
      }

      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  private drawAIOverlay(): void {
    if (!this.visualizationData || !this.gameState) return;

    const player = this.gameState.player;
    const x = player.position.x * this.CELL_SIZE;
    const y = player.position.y * this.CELL_SIZE;

    // Draw Q-value arrows
    const directions = [
      { dx: 0, dy: -1, angle: -Math.PI/2 }, // UP
      { dx: 1, dy: 0, angle: 0 },           // RIGHT
      { dx: 0, dy: 1, angle: Math.PI/2 },   // DOWN
      { dx: -1, dy: 0, angle: Math.PI }     // LEFT
    ];

    directions.forEach((dir, i) => {
      const qValue = this.visualizationData!.qValues[i];
      const probability = this.visualizationData!.actionProbabilities[i];
      
      // Normalize Q-value for visualization
      const maxQ = Math.max(...this.visualizationData!.qValues);
      const minQ = Math.min(...this.visualizationData!.qValues);
      const normalizedQ = maxQ !== minQ ? (qValue - minQ) / (maxQ - minQ) : 0.5;
      
      // Draw arrow with intensity based on Q-value
      const alpha = 0.3 + normalizedQ * 0.7;
      const length = 10 + normalizedQ * 15;
      
      this.ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
      this.ctx.lineWidth = 2 + probability * 3;
      
      const startX = x + this.CELL_SIZE / 2;
      const startY = y + this.CELL_SIZE / 2;
      const endX = startX + dir.dx * length;
      const endY = startY + dir.dy * length;
      
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
      
      // Draw arrowhead
      const headLength = 5;
      this.ctx.beginPath();
      this.ctx.moveTo(endX, endY);
      this.ctx.lineTo(
        endX - headLength * Math.cos(dir.angle - Math.PI/6),
        endY - headLength * Math.sin(dir.angle - Math.PI/6)
      );
      this.ctx.moveTo(endX, endY);
      this.ctx.lineTo(
        endX - headLength * Math.cos(dir.angle + Math.PI/6),
        endY - headLength * Math.sin(dir.angle + Math.PI/6)
      );
      this.ctx.stroke();
    });
  }

  private renderNetworkVisualization(): void {
    if (!this.visualizationData || !this.networkCtx) return;

    const canvas = this.networkCanvas.nativeElement;
    this.networkCtx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Q-values bar chart
    const barWidth = 80;
    const barSpacing = 10;
    const maxBarHeight = 100;
    const startX = 20;
    const startY = canvas.height - 20;

    const qValues = this.visualizationData.qValues;
    const maxQ = Math.max(...qValues);
    const minQ = Math.min(...qValues);
    const range = maxQ - minQ || 1;

    const actionNames = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'];

    qValues.forEach((qValue, i) => {
      const normalizedHeight = ((qValue - minQ) / range) * maxBarHeight;
      const x = startX + i * (barWidth + barSpacing);
      const y = startY - normalizedHeight;

      // Draw bar
      this.networkCtx.fillStyle = colors[i];
      this.networkCtx.fillRect(x, y, barWidth, normalizedHeight);

      // Draw Q-value text
      this.networkCtx.fillStyle = '#ffffff';
      this.networkCtx.font = '12px Arial';
      this.networkCtx.textAlign = 'center';
      this.networkCtx.fillText(
        qValue.toFixed(2),
        x + barWidth / 2,
        y - 5
      );

      // Draw action name
      this.networkCtx.fillText(
        actionNames[i],
        x + barWidth / 2,
        startY + 15
      );
    });

    // Draw exploration/exploitation indicator
    this.networkCtx.fillStyle = this.visualizationData.explorationVsExploitation === 'exploration' 
      ? '#ff9999' : '#99ff99';
    this.networkCtx.font = '14px Arial';
    this.networkCtx.textAlign = 'left';
    this.networkCtx.fillText(
      `Mode: ${this.visualizationData.explorationVsExploitation}`,
      20,
      30
    );

    // Draw state value
    this.networkCtx.fillStyle = '#ffffff';
    this.networkCtx.fillText(
      `State Value: ${this.visualizationData.stateValue.toFixed(2)}`,
      20,
      50
    );
  }

  getMaxQValue(): number {
    if (!this.visualizationData?.qValues) return 0;
    return Math.max(...this.visualizationData.qValues);
  }
}