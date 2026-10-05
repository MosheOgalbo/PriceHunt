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
      <span class="brand-lockup">
        <span class="logo"><mat-icon>local_shipping</mat-icon></span>
        <span class="titles">
          <span class="brand">PriceHunt</span>
          <span class="tag">Freight quotes</span>
        </span>
      </span>
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
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid #e4e8f2;
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
      gap: 12px;
      position: sticky; top: 0; z-index: 10;
      height: auto; min-height: 68px; flex-wrap: wrap;
      padding-inline: 20px;
    }
    .brand-lockup { display: flex; align-items: center; gap: 10px; }
    .logo {
      width: 36px; height: 36px; border-radius: 10px;
      display: grid; place-items: center;
      background: #3949ab; color: #fff;
    }
    .logo mat-icon { color: #fff; font-size: 20px; width: 20px; height: 20px; }
    .titles { display: flex; flex-direction: column; line-height: 1.1; }
    .brand { font-weight: 700; font-size: 18px; letter-spacing: 0.2px; }
    .tag { font-size: 11px; font-weight: 500; color: #6b7590; letter-spacing: 0.04em; }
    .spacer { flex: 1; }
    nav { display: flex; flex-wrap: wrap; }
    nav a { border-radius: 999px; }
    nav a.active { background: #e8ebfa; color: #3949ab; }
    .page { max-width: 1040px; margin: 0 auto; padding: 28px 16px 64px; }
  `,
})
export class AppComponent {}
