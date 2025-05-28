import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { 
  AIState, AIAction, Experience, TrainingMetrics, AIConfiguration, 
  VisualizationData, AIMode, RewardType 
} from '../models/ai.models';
import { 
  CellType, GameState, GhostState 
} from '../models/game.models';
import { NeuralNetworkService } from './neural-network.service';
import { ReplayBufferService } from './replay-buffer.service';

@Injectable({
  providedIn: 'root'
})
export class AIAgentService {
  private config: AIConfiguration = {
    learningRate: 0.00005, // Reduced from 0.0001 for more stability
    epsilon: 1.0,
    epsilonMin: 0.01,
    epsilonDecay: 0.9995, // Slower decay for better exploration
    memorySize: 50000,
    batchSize: 16, // Reduced batch size for more stable updates
    targetUpdateFrequency: 2000, // Less frequent updates for stability
    gamma: 0.95 // Slightly reduced discount factor
  };

  private readonly currentMode = new BehaviorSubject<AIMode>(AIMode.TRAINING);
  private readonly trainingMetrics = new BehaviorSubject<TrainingMetrics>({
    episode: 0,
    score: 0,
    epsilon: 1.0,
    loss: 0,
    averageReward: 0,
    explorationRate: 1.0,
    gamesPlayed: 0,
    bestScore: 0,
    averageScore: 0
  });
  private readonly visualizationData = new BehaviorSubject<VisualizationData>({
    qValues: [0, 0, 0, 0],
    actionProbabilities: [0.25, 0.25, 0.25, 0.25],
    stateValue: 0,
    explorationVsExploitation: 'exploration',
    networkActivations: []
  });

  private isTraining = false;
  private trainingStepCount = 0;
  private episodeCount = 0;
  private readonly scoreHistory: number[] = [];
  private lastState: AIState | null = null;
  private lastAction: number | null = null;
  private readonly targetNetwork: NeuralNetworkService;

  constructor(
    private readonly mainNetwork: NeuralNetworkService,
    private readonly replayBuffer: ReplayBufferService,
    private readonly ngZone: NgZone
  ) {
    this.targetNetwork = new NeuralNetworkService();
    this.targetNetwork.loadWeights(this.mainNetwork.saveWeights());
  }

  get mode$(): Observable<AIMode> {
    return this.currentMode.asObservable();
  }

  get trainingMetrics$(): Observable<TrainingMetrics> {
    return this.trainingMetrics.asObservable();
  }

  get visualizationData$(): Observable<VisualizationData> {
    return this.visualizationData.asObservable();
  }

  setMode(mode: AIMode): void {
    this.currentMode.next(mode);
    if (mode === AIMode.TRAINING) {
      this.isTraining = true;
    } else {
      this.isTraining = false;
    }
  }

  getAction(gameState: GameState): AIAction {
    const aiState = this.convertGameStateToAIState(gameState);
    const stateVector = this.encodeState(aiState);
    
    let action: number;
    let explorationVsExploitation: 'exploration' | 'exploitation';

    if (this.isTraining && Math.random() < this.config.epsilon) {
      // Exploration: random action
      action = Math.floor(Math.random() * 4);
      explorationVsExploitation = 'exploration';
    } else {
      // Exploitation: choose best action according to Q-network
      const { output: qValues, activations } = this.mainNetwork.forward(stateVector);
      action = this.getBestAction(qValues);
      explorationVsExploitation = 'exploitation';
      
      // Update visualization data
      this.updateVisualizationData(qValues, activations, explorationVsExploitation);
    }

    // Store state and action for learning
    if (this.isTraining) {
      this.lastState = aiState;
      this.lastAction = action;
    }

    return {
      direction: action,
      confidence: explorationVsExploitation === 'exploitation' ? 0.8 : 0.2
    };
  }

  learn(gameState: GameState, reward: number, done: boolean): void {
    if (!this.isTraining || !this.lastState || this.lastAction === null) {
      return;
    }

    const currentState = this.convertGameStateToAIState(gameState);
    
    // Create experience
    const experience: Experience = {
      state: this.lastState,
      action: this.lastAction,
      reward,
      nextState: currentState,
      done
    };

    // Add to replay buffer
    this.replayBuffer.add(experience);

    // Train the network if we have enough experiences
    if (this.replayBuffer.size() >= this.config.batchSize) {
      this.trainNetwork();
    }

    // Update target network periodically
    if (this.trainingStepCount % this.config.targetUpdateFrequency === 0) {
      this.targetNetwork.loadWeights(this.mainNetwork.saveWeights());
    }

    this.trainingStepCount++;

    // Update epsilon (exploration decay)
    if (this.config.epsilon > this.config.epsilonMin) {
      this.config.epsilon *= this.config.epsilonDecay;
    }

    // Update metrics
    this.updateMetrics(currentState.score, done);
  }

  private convertGameStateToAIState(gameState: GameState): AIState {
    return {
      grid: gameState.level.grid.map(row => [...row]),
      playerPosition: { ...gameState.player.position },
      ghostPositions: gameState.ghosts.map(ghost => ({
        x: ghost.position.x,
        y: ghost.position.y,
        type: ghost.type,
        state: ghost.state
      })),
      dotsRemaining: gameState.level.dotCount - gameState.dotsEaten,
      powerPelletActive: gameState.powerPelletActive,
      score: gameState.player.score,
      lives: gameState.player.lives
    };
  }

  private encodeState(state: AIState): number[] {
    const encoded: number[] = [];
    
    // Validate state first
    if (!state || !state.grid || !state.playerPosition || !state.ghostPositions) {
      console.warn('Invalid AI state detected, using default encoding');
      return Array(128).fill(0);
    }
    
    // Flatten grid (20x30 = 600, but we'll use a smaller representation)
    const gridSize = 8; // Reduce to 8x8 for computational efficiency
    const scaleX = state.grid[0].length / gridSize;
    const scaleY = state.grid.length / gridSize;
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const originalX = Math.floor(x * scaleX);
        const originalY = Math.floor(y * scaleY);
        
        // Safety bounds checking
        if (originalY >= 0 && originalY < state.grid.length && 
            originalX >= 0 && originalX < state.grid[0].length) {
          const cellValue = state.grid[originalY][originalX] / 5.0; // Normalize
          encoded.push(isFinite(cellValue) ? cellValue : 0);
        } else {
          encoded.push(0);
        }
      }
    }

    // Player position (normalized with safety checks)
    const playerX = isFinite(state.playerPosition.x) ? state.playerPosition.x / state.grid[0].length : 0;
    const playerY = isFinite(state.playerPosition.y) ? state.playerPosition.y / state.grid.length : 0;
    encoded.push(Math.max(0, Math.min(1, playerX)));
    encoded.push(Math.max(0, Math.min(1, playerY)));

    // Ghost positions and states (4 ghosts max)
    for (let i = 0; i < 4; i++) {
      if (i < state.ghostPositions.length) {
        const ghost = state.ghostPositions[i];
        const ghostX = isFinite(ghost.x) ? ghost.x / state.grid[0].length : 0;
        const ghostY = isFinite(ghost.y) ? ghost.y / state.grid.length : 0;
        const ghostType = isFinite(ghost.type) ? ghost.type / 4.0 : 0;
        const ghostState = isFinite(ghost.state) ? ghost.state / 3.0 : 0;
        
        encoded.push(Math.max(0, Math.min(1, ghostX)));
        encoded.push(Math.max(0, Math.min(1, ghostY)));
        encoded.push(Math.max(0, Math.min(1, ghostType)));
        encoded.push(Math.max(0, Math.min(1, ghostState)));
      } else {
        encoded.push(0, 0, 0, 0); // Padding for missing ghosts
      }
    }

    // Game state features with safety checks
    const dotsNormalized = isFinite(state.dotsRemaining) ? state.dotsRemaining / 100.0 : 0;
    const scoreNormalized = isFinite(state.score) ? state.score / 10000.0 : 0;
    const livesNormalized = isFinite(state.lives) ? state.lives / 3.0 : 0;
    
    encoded.push(Math.max(0, Math.min(1, dotsNormalized)));
    encoded.push(state.powerPelletActive ? 1.0 : 0.0);
    encoded.push(Math.max(0, Math.min(1, scoreNormalized)));
    encoded.push(Math.max(0, Math.min(1, livesNormalized)));

    // Pad to exactly 128 features
    while (encoded.length < 128) {
      encoded.push(0);
    }

    return encoded.slice(0, 128);
  }

  private getBestAction(qValues: number[]): number {
    // Safety check for invalid Q-values
    if (!qValues || qValues.length === 0) {
      return 0; // Default action
    }
    
    let bestAction = 0;
    let bestValue = qValues[0];
    
    for (let i = 1; i < qValues.length; i++) {
      if (isFinite(qValues[i]) && qValues[i] > bestValue) {
        bestValue = qValues[i];
        bestAction = i;
      }
    }
    
    return bestAction;
  }

  private trainNetwork(): void {
    const batch = this.replayBuffer.sample(this.config.batchSize);
    let totalLoss = 0;

    for (const experience of batch) {
      const stateVector = this.encodeState(experience.state);
      const nextStateVector = this.encodeState(experience.nextState);
      
      // Get current Q-values
      const currentQValues = this.mainNetwork.predict(stateVector);
      
      // Get target Q-values
      const target = [...currentQValues];
      
      if (experience.done) {
        target[experience.action] = experience.reward;
      } else {
        const nextQValues = this.targetNetwork.predict(nextStateVector);
        const maxNextQ = Math.max(...nextQValues);
        target[experience.action] = experience.reward + this.config.gamma * maxNextQ;
      }
      
      // Train the network
      const loss = this.mainNetwork.backward(stateVector, target, this.config.learningRate);
      totalLoss += loss;
    }

    const averageLoss = totalLoss / batch.length;
    this.updateLossMetrics(averageLoss);
  }

  private updateVisualizationData(
    qValues: number[], 
    activations: number[][],
    explorationVsExploitation: 'exploration' | 'exploitation'
  ): void {
    // Validate Q-values first
    const validQValues = qValues.map(q => isFinite(q) ? q : 0);
    
    // Calculate action probabilities with stable softmax
    let actionProbabilities: number[];
    
    if (explorationVsExploitation === 'exploration') {
      // During exploration, use uniform distribution
      actionProbabilities = [0.25, 0.25, 0.25, 0.25];
    } else {
      // Use temperature-scaled softmax for numerical stability
      const temperature = 1.0; // Controls how "sharp" the distribution is
      const scaledQValues = validQValues.map(q => q / temperature);
      
      // Find max for numerical stability
      const maxQ = Math.max(...scaledQValues);
      
      // Subtract max to prevent overflow (standard softmax trick)
      const expValues = scaledQValues.map(q => {
        const expVal = Math.exp(q - maxQ);
        return isFinite(expVal) ? expVal : 0;
      });
      
      // Calculate sum with safety check
      const sumExp = expValues.reduce((sum, val) => sum + val, 0);
      
      if (sumExp > 0 && isFinite(sumExp)) {
        actionProbabilities = expValues.map(val => val / sumExp);
      } else {
        // Fallback to uniform distribution if softmax fails
        actionProbabilities = [0.25, 0.25, 0.25, 0.25];
      }
      
      // Additional safety check - ensure probabilities sum to 1
      const probSum = actionProbabilities.reduce((sum, p) => sum + p, 0);
      if (Math.abs(probSum - 1.0) > 0.01) {
        actionProbabilities = [0.25, 0.25, 0.25, 0.25];
      }
    }
    
    // Calculate state value safely
    const stateValue = validQValues.length > 0 ? Math.max(...validQValues) : 0;
    
    // Validate all visualization data before sending
    const safeVisualizationData: VisualizationData = {
      qValues: validQValues,
      actionProbabilities: actionProbabilities.map(p => isFinite(p) ? Math.max(0, Math.min(1, p)) : 0.25),
      stateValue: isFinite(stateValue) ? stateValue : 0,
      explorationVsExploitation,
      networkActivations: activations.map(layer => 
        layer.map(activation => isFinite(activation) ? activation : 0)
      )
    };

    this.visualizationData.next(safeVisualizationData);
  }

  private updateMetrics(score: number, done: boolean): void {
    if (done) {
      this.episodeCount++;
      this.scoreHistory.push(score);
      
      // Keep only last 100 scores for average calculation
      if (this.scoreHistory.length > 100) {
        this.scoreHistory.shift();
      }
    }

    const bestScore = Math.max(...this.scoreHistory, 0);
    const averageScore = this.scoreHistory.length > 0 
      ? this.scoreHistory.reduce((sum, s) => sum + s, 0) / this.scoreHistory.length 
      : 0;

    this.trainingMetrics.next({
      episode: this.episodeCount,
      score,
      epsilon: this.config.epsilon,
      loss: this.trainingMetrics.value.loss,
      averageReward: this.trainingMetrics.value.averageReward,
      explorationRate: this.config.epsilon,
      gamesPlayed: this.episodeCount,
      bestScore,
      averageScore
    });
  }

  private updateLossMetrics(loss: number): void {
    const current = this.trainingMetrics.value;
    this.trainingMetrics.next({
      ...current,
      loss
    });
  }

  calculateReward(
    previousState: GameState, 
    currentState: GameState, 
    action: number
  ): number {
    let reward = 0;

    // Validate input states
    if (!previousState || !currentState) {
      return 0;
    }

    // Basic time penalty to encourage faster completion
    reward += RewardType.TIME_PENALTY;

    // Reward for collecting dots
    const dotsEatenDiff = currentState.dotsEaten - previousState.dotsEaten;
    if (isFinite(dotsEatenDiff) && dotsEatenDiff > 0) {
      reward += dotsEatenDiff * RewardType.DOT_COLLECTED;
    }

    // Reward for collecting power pellets
    if (currentState.powerPelletActive && !previousState.powerPelletActive) {
      reward += RewardType.POWER_PELLET_COLLECTED;
    }

    // Reward for eating ghosts
    const previousGhostsEaten = previousState.ghosts.filter(g => g.state === GhostState.EATEN).length;
    const currentGhostsEaten = currentState.ghosts.filter(g => g.state === GhostState.EATEN).length;
    if (currentGhostsEaten > previousGhostsEaten) {
      reward += RewardType.GHOST_EATEN;
    }

    // Penalty for losing a life
    if (currentState.player.lives < previousState.player.lives) {
      reward += RewardType.DEATH_PENALTY;
    }

    // Reward for level completion
    if (currentState.dotsEaten >= currentState.level.dotCount) {
      reward += RewardType.LEVEL_COMPLETED;
    }

    // Penalty for hitting walls (if position didn't change when it should have)
    if (this.isInvalidMove(previousState, currentState, action)) {
      reward += RewardType.WALL_HIT_PENALTY;
    }

    // Clamp reward to prevent extreme values
    reward = Math.max(-1000, Math.min(1000, reward));
    
    // Ensure reward is finite
    return isFinite(reward) ? reward : 0;
  }

  private isInvalidMove(
    previousState: GameState, 
    currentState: GameState, 
    action: number
  ): boolean {
    // Check if the player tried to move but position didn't change
    const prevPos = previousState.player.position;
    const currPos = currentState.player.position;
    
    if (prevPos.x === currPos.x && prevPos.y === currPos.y) {
      // Position didn't change, check if action was trying to move into a wall
      const grid = previousState.level.grid;
      let targetX = prevPos.x;
      let targetY = prevPos.y;
      
      switch (action) {
        case 0: targetY--; break; // UP
        case 1: targetX++; break; // RIGHT
        case 2: targetY++; break; // DOWN
        case 3: targetX--; break; // LEFT
      }
      
      // Check bounds and wall collision
      if (targetY < 0 || targetY >= grid.length || 
          targetX < 0 || targetX >= grid[0].length ||
          grid[targetY][targetX] === CellType.WALL) {
        return true;
      }
    }
    
    return false;
  }

  reset(): void {
    this.lastState = null;
    this.lastAction = null;
  }

  saveModel(): string {
    const modelData = {
      weights: this.mainNetwork.saveWeights(),
      config: this.config,
      metrics: this.trainingMetrics.value
    };
    return JSON.stringify(modelData);
  }

  loadModel(modelData: string): void {
    try {
      const data = JSON.parse(modelData);
      this.mainNetwork.loadWeights(data.weights);
      this.targetNetwork.loadWeights(data.weights);
      this.config = { ...this.config, ...data.config };
      
      if (data.metrics) {
        this.trainingMetrics.next(data.metrics);
      }
    } catch (error) {
      console.error('Failed to load model:', error);
    }
  }
}