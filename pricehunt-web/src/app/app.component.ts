import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar class="topbar">
      <mat-icon>local_shipping</mat-icon>
      <span class="brand">PriceHunt</span>
      <span class="spacer"></span>
      <nav>
        <a mat-button routerLink="/search" routerLinkActive="active">Live search</a>
        <a mat-button routerLink="/history" routerLinkActive="active">History</a>
      </nav>
    </mat-toolbar>
    <main class="page"><router-outlet /></main>
  `,
  styles: `
    .topbar {
      background: #fff; border-bottom: 1px solid #e3e6ef; gap: 10px;
      position: sticky; top: 0; z-index: 10; height: auto; min-height: 64px; flex-wrap: wrap;
    }
    .brand { font-weight: 700; font-size: 20px; letter-spacing: .3px; }
    .spacer { flex: 1; }
    nav { display: flex; flex-wrap: wrap; }
    mat-icon { color: #3949ab; }
    nav a.active { background: #eef0fb; color: #3949ab; }
    .page { max-width: 1040px; margin: 0 auto; padding: 24px 16px 48px; }
  `,
})
export class AppComponent {}
