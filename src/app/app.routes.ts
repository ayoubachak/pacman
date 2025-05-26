import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/menu', pathMatch: 'full' },
  { 
    path: 'menu', 
    loadComponent: () => import('./features/menu/menu.component').then(m => m.MenuComponent) 
  },
  { 
    path: 'game', 
    loadComponent: () => import('./features/game/game.component').then(m => m.GameComponent) 
  },
  { 
    path: 'game/:levelId', 
    loadComponent: () => import('./features/game/game.component').then(m => m.GameComponent) 
  },
  { 
    path: 'settings', 
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) 
  },
  { path: '**', redirectTo: '/menu' }
];
