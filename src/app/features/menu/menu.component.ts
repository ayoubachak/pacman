import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { GameService } from '../../shared/services/game.service';
import { LEVELS } from '../../shared/models/levels.data';
import { THEMES } from '../../shared/models/themes.data';
import { Theme } from '../../shared/models/game.models';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit {
  levels = LEVELS;
  themes = THEMES;
  selectedTheme: string = 'classic';
  
  constructor(
    private router: Router,
    private gameService: GameService
  ) {}
  
  ngOnInit(): void {
    // Get the current theme from the game service
    this.gameService.currentTheme$.subscribe((theme: Theme) => {
      this.selectedTheme = theme.id;
    });
  }
  
  startGame(levelId: number = 1): void {
    console.log(`Starting game with level ID: ${levelId} from menu`);
    // Set the level ID but don't start the game directly
    // Let the game component handle starting the game based on route params
    this.router.navigate(['/game', levelId]);
  }
  
  goToSettings(): void {
    this.router.navigate(['/settings']);
  }
  
  setTheme(themeId: string): void {
    this.selectedTheme = themeId;
    this.gameService.setTheme(themeId);
  }
} 