import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  difficulty: 'easy' | 'normal' | 'hard';
  controlType: 'arrows' | 'wasd' | 'swipe';
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly STORAGE_KEY = 'pacman-settings';
  private defaultSettings: GameSettings = {
    soundEnabled: true,
    musicEnabled: true,
    difficulty: 'normal',
    controlType: 'arrows'
  };
  
  private settings = new BehaviorSubject<GameSettings>(this.loadSettings());

  constructor() {}

  get settings$(): Observable<GameSettings> {
    return this.settings.asObservable();
  }

  updateSettings(settings: Partial<GameSettings>): void {
    const currentSettings = this.settings.value;
    const newSettings = { ...currentSettings, ...settings };
    
    this.settings.next(newSettings);
    this.saveSettings(newSettings);
  }

  resetToDefaults(): void {
    this.settings.next({ ...this.defaultSettings });
    this.saveSettings(this.defaultSettings);
  }

  private loadSettings(): GameSettings {
    try {
      const storedSettings = localStorage.getItem(this.STORAGE_KEY);
      if (storedSettings) {
        return JSON.parse(storedSettings);
      }
    } catch (error) {
      console.error('Error loading settings', error);
    }
    
    return { ...this.defaultSettings };
  }

  private saveSettings(settings: GameSettings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings', error);
    }
  }
} 