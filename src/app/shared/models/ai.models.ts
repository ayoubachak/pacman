export interface AIState {
  grid: number[][];
  playerPosition: { x: number; y: number };
  ghostPositions: Array<{ x: number; y: number; type: number; state: number }>;
  dotsRemaining: number;
  powerPelletActive: boolean;
  score: number;
  lives: number;
}

export interface AIAction {
  direction: number; // 0: UP, 1: RIGHT, 2: DOWN, 3: LEFT, 4: NONE
  confidence: number;
}

export interface Experience {
  state: AIState;
  action: number;
  reward: number;
  nextState: AIState;
  done: boolean;
}

export interface NetworkWeights {
  layers: Array<{
    weights: number[][];
    biases: number[];
  }>;
}

export interface TrainingMetrics {
  episode: number;
  score: number;
  epsilon: number;
  loss: number;
  averageReward: number;
  explorationRate: number;
  gamesPlayed: number;
  bestScore: number;
  averageScore: number;
}

export interface AIConfiguration {
  learningRate: number;
  epsilon: number;
  epsilonMin: number;
  epsilonDecay: number;
  memorySize: number;
  batchSize: number;
  targetUpdateFrequency: number;
  gamma: number; // discount factor
}

export interface VisualizationData {
  qValues: number[];
  actionProbabilities: number[];
  stateValue: number;
  explorationVsExploitation: 'exploration' | 'exploitation';
  networkActivations: number[][];
}

export enum AIMode {
  TRAINING = 'training',
  INFERENCE = 'inference',
  EVALUATION = 'evaluation'
}

export enum RewardType {
  DOT_COLLECTED = 10,
  POWER_PELLET_COLLECTED = 50,
  GHOST_EATEN = 200,
  LEVEL_COMPLETED = 1000,
  DEATH_PENALTY = -500,
  WALL_HIT_PENALTY = -10,
  TIME_PENALTY = -1,
  PROGRESS_REWARD = 5
}