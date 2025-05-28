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
      
      // Apply activation function (ReLU for hidden layers, linear for output)
      const activated = i < this.weights.layers.length - 1 
        ? output.map(x => Math.max(0, x)) // ReLU
        : output; // Linear for output layer
      
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
        sum += input[j] * weights[i][j];
      }
      result.push(sum);
    }
    
    return result;
  }

  backward(
    input: number[], 
    target: number[], 
    learningRate: number = 0.001
  ): number {
    const { output, activations } = this.forward(input);
    
    // Calculate loss (Mean Squared Error)
    const loss = output.reduce((sum, val, i) => 
      sum + Math.pow(val - target[i], 2), 0) / output.length;

    // Backpropagation
    let delta = output.map((val, i) => 2 * (val - target[i]) / output.length);

    // Update weights and biases layer by layer (backwards)
    for (let layerIdx = this.weights.layers.length - 1; layerIdx >= 0; layerIdx--) {
      const layer = this.weights.layers[layerIdx];
      const prevActivation = activations[layerIdx];
      
      // Update weights
      for (let i = 0; i < layer.weights.length; i++) {
        for (let j = 0; j < layer.weights[i].length; j++) {
          layer.weights[i][j] -= learningRate * delta[i] * prevActivation[j];
        }
        // Update biases
        layer.biases[i] -= learningRate * delta[i];
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
}