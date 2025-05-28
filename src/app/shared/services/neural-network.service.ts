import { Injectable } from '@angular/core';
import { NetworkWeights } from '../models/ai.models';

@Injectable({
  providedIn: 'root'
})
export class NeuralNetworkService {
  private weights: NetworkWeights;
  private readonly inputSize = 128; // Flattened game state
  private readonly hiddenSizes = [256, 256, 128];
  private readonly outputSize = 4; // 4 possible actions (UP, RIGHT, DOWN, LEFT)

  constructor() {
    this.weights = this.initializeWeights();
  }

  private initializeWeights(): NetworkWeights {
    const layers: Array<{ weights: number[][]; biases: number[] }> = [];
    const sizes = [this.inputSize, ...this.hiddenSizes, this.outputSize];

    for (let i = 0; i < sizes.length - 1; i++) {
      const inputSize = sizes[i];
      const outputSize = sizes[i + 1];
      
      // Xavier/Glorot initialization
      const limit = Math.sqrt(6 / (inputSize + outputSize));
      
      const weights = Array(outputSize).fill(0).map(() =>
        Array(inputSize).fill(0).map(() => 
          (Math.random() * 2 - 1) * limit
        )
      );
      
      const biases = Array(outputSize).fill(0);
      
      layers.push({ weights, biases });
    }

    return { layers };
  }

  forward(input: number[]): { output: number[]; activations: number[][] } {
    const activations: number[][] = [input];
    let currentInput = input;

    for (let i = 0; i < this.weights.layers.length; i++) {
      const layer = this.weights.layers[i];
      const output = this.matrixMultiply(currentInput, layer.weights, layer.biases);
      
      // Apply activation function (ReLU for hidden layers, tanh for output to bound values)
      let activated: number[];
      if (i < this.weights.layers.length - 1) {
        // ReLU for hidden layers
        activated = output.map(x => Math.max(0, x));
      } else {
        // Use tanh for output layer to bound Q-values between -1 and 1, then scale
        activated = output.map(x => {
          const tanhVal = Math.tanh(x / 10); // Scale down input to tanh
          return tanhVal * 100; // Scale output to reasonable Q-value range
        });
      }
      
      activations.push(activated);
      currentInput = activated;
    }

    return { output: currentInput, activations };
  }

  private matrixMultiply(input: number[], weights: number[][], biases: number[]): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < weights.length; i++) {
      let sum = biases[i];
      for (let j = 0; j < input.length; j++) {
        // Check for NaN/Infinity in inputs and weights
        if (!isFinite(input[j]) || !isFinite(weights[i][j])) {
          console.warn('Invalid value detected in neural network computation');
          sum += 0; // Skip invalid values
        } else {
          sum += input[j] * weights[i][j];
        }
      }
      // Clamp large values to prevent overflow
      result.push(Math.max(-1000, Math.min(1000, sum)));
    }
    
    return result;
  }

  backward(
    input: number[], 
    target: number[], 
    learningRate: number = 0.001
  ): number {
    // Validate inputs
    if (!this.validateInputs(input, target)) {
      return 0; // Return 0 loss for invalid inputs
    }

    const { output, activations } = this.forward(input);
    
    // Calculate loss (Mean Squared Error) with numerical stability
    let loss = 0;
    for (let i = 0; i < output.length; i++) {
      const diff = output[i] - target[i];
      if (isFinite(diff)) {
        loss += diff * diff;
      }
    }
    loss = loss / output.length;
    
    // Check for invalid loss
    if (!isFinite(loss)) {
      console.warn('Invalid loss detected, skipping update');
      return 0;
    }

    // Backpropagation with gradient clipping
    let delta = output.map((val, i) => {
      const grad = 2 * (val - target[i]) / output.length;
      // Clip gradients to prevent explosion
      return Math.max(-10, Math.min(10, grad));
    });

    // Update weights and biases layer by layer (backwards)
    for (let layerIdx = this.weights.layers.length - 1; layerIdx >= 0; layerIdx--) {
      const layer = this.weights.layers[layerIdx];
      const prevActivation = activations[layerIdx];
      
      // Update weights with gradient clipping
      for (let i = 0; i < layer.weights.length; i++) {
        for (let j = 0; j < layer.weights[i].length; j++) {
          const gradient = delta[i] * prevActivation[j];
          const clippedGradient = Math.max(-1, Math.min(1, gradient));
          const weightUpdate = learningRate * clippedGradient;
          
          layer.weights[i][j] -= weightUpdate;
          
          // Prevent weights from becoming too large
          layer.weights[i][j] = Math.max(-100, Math.min(100, layer.weights[i][j]));
          
          // Check for NaN
          if (!isFinite(layer.weights[i][j])) {
            console.warn('NaN weight detected, reinitializing');
            layer.weights[i][j] = (Math.random() * 2 - 1) * 0.1;
          }
        }
        
        // Update biases with clipping
        const biasUpdate = learningRate * delta[i];
        layer.biases[i] -= Math.max(-1, Math.min(1, biasUpdate));
        layer.biases[i] = Math.max(-100, Math.min(100, layer.biases[i]));
        
        // Check for NaN
        if (!isFinite(layer.biases[i])) {
          console.warn('NaN bias detected, reinitializing');
          layer.biases[i] = 0;
        }
      }

      // Calculate delta for previous layer (if not input layer)
      if (layerIdx > 0) {
        const newDelta = Array(prevActivation.length).fill(0);
        for (let i = 0; i < newDelta.length; i++) {
          for (let j = 0; j < delta.length; j++) {
            newDelta[i] += delta[j] * layer.weights[j][i];
          }
          // Apply derivative of ReLU
          if (prevActivation[i] <= 0) {
            newDelta[i] = 0;
          }
          // Clip gradients
          newDelta[i] = Math.max(-10, Math.min(10, newDelta[i]));
        }
        delta = newDelta;
      }
    }

    return loss;
  }

  predict(input: number[]): number[] {
    return this.forward(input).output;
  }

  clone(): NetworkWeights {
    return JSON.parse(JSON.stringify(this.weights));
  }

  loadWeights(weights: NetworkWeights): void {
    this.weights = JSON.parse(JSON.stringify(weights));
  }

  saveWeights(): NetworkWeights {
    return this.clone();
  }

  // Soft update for target network
  updateTargetNetwork(targetWeights: NetworkWeights, tau: number = 0.005): void {
    for (let i = 0; i < this.weights.layers.length; i++) {
      const mainLayer = this.weights.layers[i];
      const targetLayer = targetWeights.layers[i];
      
      // Update weights
      for (let j = 0; j < mainLayer.weights.length; j++) {
        for (let k = 0; k < mainLayer.weights[j].length; k++) {
          targetLayer.weights[j][k] = tau * mainLayer.weights[j][k] + 
                                     (1 - tau) * targetLayer.weights[j][k];
        }
      }
      
      // Update biases
      for (let j = 0; j < mainLayer.biases.length; j++) {
        targetLayer.biases[j] = tau * mainLayer.biases[j] + 
                               (1 - tau) * targetLayer.biases[j];
      }
    }
  }

  private validateInputs(input: number[], target: number[]): boolean {
    // Check input array
    for (let i = 0; i < input.length; i++) {
      if (!isFinite(input[i])) {
        console.warn(`Invalid input at index ${i}: ${input[i]}`);
        return false;
      }
    }
    
    // Check target array
    for (let i = 0; i < target.length; i++) {
      if (!isFinite(target[i])) {
        console.warn(`Invalid target at index ${i}: ${target[i]}`);
        return false;
      }
    }
    
    return true;
  }
}