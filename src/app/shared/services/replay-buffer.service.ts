import { Injectable } from '@angular/core';
import { Experience } from '../models/ai.models';

@Injectable({
  providedIn: 'root'
})
export class ReplayBufferService {
  private buffer: Experience[] = [];
  private maxSize: number;
  private currentIndex = 0;

  constructor() {
    this.maxSize = 50000; // Large buffer for better learning
  }

  add(experience: Experience): void {
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(experience);
    } else {
      // Overwrite oldest experience (circular buffer)
      this.buffer[this.currentIndex] = experience;
      this.currentIndex = (this.currentIndex + 1) % this.maxSize;
    }
  }

  sample(batchSize: number): Experience[] {
    if (this.buffer.length < batchSize) {
      return [...this.buffer]; // Return all if not enough experiences
    }

    const samples: Experience[] = [];
    const indices = new Set<number>();

    while (indices.size < batchSize) {
      const randomIndex = Math.floor(Math.random() * this.buffer.length);
      if (!indices.has(randomIndex)) {
        indices.add(randomIndex);
        samples.push(this.buffer[randomIndex]);
      }
    }

    return samples;
  }

  size(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
    this.currentIndex = 0;
  }

  // Prioritized experience replay (optional enhancement)
  samplePrioritized(batchSize: number, priorities?: number[]): Experience[] {
    if (!priorities || priorities.length !== this.buffer.length) {
      return this.sample(batchSize); // Fall back to uniform sampling
    }

    const samples: Experience[] = [];
    const totalPriority = priorities.reduce((sum, p) => sum + p, 0);

    for (let i = 0; i < batchSize && i < this.buffer.length; i++) {
      let randomValue = Math.random() * totalPriority;
      let selectedIndex = 0;

      for (let j = 0; j < priorities.length; j++) {
        randomValue -= priorities[j];
        if (randomValue <= 0) {
          selectedIndex = j;
          break;
        }
      }

      samples.push(this.buffer[selectedIndex]);
    }

    return samples;
  }

  getLatest(count: number): Experience[] {
    const startIndex = Math.max(0, this.buffer.length - count);
    return this.buffer.slice(startIndex);
  }

  setMaxSize(size: number): void {
    this.maxSize = size;
    if (this.buffer.length > size) {
      this.buffer = this.buffer.slice(-size);
      this.currentIndex = 0;
    }
  }
}