import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { GameSettings, SettingsService } from '../../shared/services/settings.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit, OnDestroy {
  settings: GameSettings = {
    soundEnabled: true,
    musicEnabled: true,
    difficulty: 'normal',
    controlType: 'arrows'
  };
  
  private destroyed$ = new Subject<void>();
  
  constructor(
    private settingsService: SettingsService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    this.settingsService.settings$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(settings => {
        this.settings = { ...settings };
      });
  }
  
  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }
  
  saveSettings(): void {
    this.settingsService.updateSettings(this.settings);
    this.goToMainMenu();
  }
  
  resetSettings(): void {
    this.settingsService.resetToDefaults();
  }
  
  goToMainMenu(): void {
    this.router.navigate(['/menu']);
  }
} 