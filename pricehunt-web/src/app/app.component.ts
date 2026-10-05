import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LanguageService } from './core/i18n/language.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <mat-toolbar class="topbar">
      <span class="brand-lockup">
        <span class="logo"><mat-icon>local_shipping</mat-icon></span>
        <span class="titles">
          <span class="brand">PriceHunt</span>
          <span class="tag">{{ i18n.t('tagline') }}</span>
        </span>
      </span>
      <span class="spacer"></span>
      <button
        type="button"
        class="lang-trigger"
        [matMenuTriggerFor]="languageMenu"
        [attr.aria-label]="i18n.t('language')"
      >
        <mat-icon>translate</mat-icon>
        <span>{{ i18n.current().native }}</span>
        <mat-icon class="caret">expand_more</mat-icon>
      </button>
      <mat-menu #languageMenu="matMenu" class="lang-menu" xPosition="before">
        @for (language of i18n.languages; track language.id) {
          <button mat-menu-item type="button" (click)="i18n.set(language.id)">
            <mat-icon [class.hidden-check]="i18n.lang() !== language.id">check</mat-icon>
            <span>{{ language.native }}</span>
          </button>
        }
      </mat-menu>
      <nav>
        <a mat-button routerLink="/search" routerLinkActive="active">{{ i18n.t('liveSearch') }}</a>
        <a mat-button routerLink="/history" routerLinkActive="active">{{ i18n.t('history') }}</a>
      </nav>
    </mat-toolbar>
    <main class="page"><router-outlet /></main>
  `,
  styles: `
    .topbar {
      background: #fff;
      border-bottom: 1px solid #e4e8f2;
      gap: 12px;
      position: sticky; top: 0; z-index: 10;
      height: auto; min-height: 64px; flex-wrap: wrap;
      padding-inline: 20px;
    }
    .brand-lockup { display: flex; align-items: center; gap: 10px; }
    .logo {
      width: 36px; height: 36px; border-radius: 10px;
      display: grid; place-items: center;
      background: #3949ab; color: #fff;
      box-shadow: 0 6px 14px rgba(57, 73, 171, 0.28);
    }
    .logo mat-icon { color: #fff; font-size: 20px; width: 20px; height: 20px; }
    .titles { display: flex; flex-direction: column; line-height: 1.15; }
    .brand { font-weight: 800; font-size: 17px; letter-spacing: -0.02em; }
    .tag { font-size: 11px; font-weight: 600; color: #6b7590; }
    .spacer { flex: 1; }
    nav {
      display: flex; flex-wrap: wrap; gap: 2px;
      padding: 4px; border-radius: 999px; background: #f2f4f8;
    }
    nav a { border-radius: 999px; min-width: 0; }
    nav a.active { background: #fff; color: #3949ab; box-shadow: 0 1px 2px rgba(28, 36, 52, 0.08); }
    .lang-trigger {
      display: inline-flex; align-items: center; gap: 6px;
      height: 36px; padding-block: 0; padding-inline: 12px 10px;
      border: 1px solid #d5dbe8; border-radius: 999px;
      background: #fff; color: #1c2434;
      font: inherit; font-size: 14px; font-weight: 600;
      cursor: pointer;
    }
    .lang-trigger mat-icon { font-size: 18px; width: 18px; height: 18px; color: #3949ab; }
    .lang-trigger .caret { color: #6b7590; }
    .lang-trigger:hover { border-color: #3949ab; background: #f7f8fd; }
    .page { max-width: 1120px; margin: 0 auto; padding: 28px 20px 72px; }
  `,
})
export class AppComponent {
  readonly i18n = inject(LanguageService);
}
