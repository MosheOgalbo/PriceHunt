import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LanguageService } from './core/i18n/language.service';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule,
  ],
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
      <div class="chrome">
        <button
          type="button"
          class="icon-chip"
          (click)="theme.toggle()"
          [attr.aria-label]="theme.isDark() ? i18n.t('themeLight') : i18n.t('themeDark')"
          [matTooltip]="theme.isDark() ? i18n.t('themeLight') : i18n.t('themeDark')"
        >
          <mat-icon>{{ theme.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>
        <button
          type="button"
          class="lang-trigger"
          [matMenuTriggerFor]="languageMenu"
          [attr.aria-label]="i18n.t('language')"
        >
          <mat-icon>translate</mat-icon>
          <span class="lang-label">{{ i18n.current().native }}</span>
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
      </div>
    </mat-toolbar>
    <main class="page"><router-outlet /></main>
  `,
  styles: `
    .topbar {
      background: linear-gradient(180deg, var(--ph-toolbar-from) 0%, var(--ph-toolbar-to) 100%);
      color: var(--ph-toolbar-text);
      border-bottom: 3px solid var(--ph-sea);
      gap: 10px;
      position: sticky; top: 0; z-index: 10;
      height: auto; min-height: 64px;
      flex-wrap: nowrap;
      padding-inline: 16px;
      box-shadow: 0 8px 24px rgba(6, 37, 54, 0.18);
    }
    .brand-lockup { display: flex; align-items: center; gap: 10px; min-width: 0; flex: none; }
    .logo {
      width: 36px; height: 36px; border-radius: 10px; flex: none;
      display: grid; place-items: center;
      background: var(--ph-logo-bg);
      border: 1px solid rgba(255, 255, 255, 0.35);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .logo mat-icon {
      color: var(--ph-logo-fg) !important;
      font-size: 20px; width: 20px; height: 20px;
    }
    .titles { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
    .brand { font-weight: 800; font-size: 17px; letter-spacing: -0.02em; color: var(--ph-toolbar-text); }
    .tag { font-size: 11px; font-weight: 600; color: var(--ph-toolbar-muted); }
    .spacer { flex: 1; min-width: 8px; }
    .chrome {
      display: flex; align-items: center; gap: 8px; flex: none; flex-wrap: nowrap;
    }
    nav {
      display: flex; flex-wrap: nowrap; gap: 2px;
      padding: 4px; border-radius: 999px; background: rgba(255, 255, 255, 0.1);
    }
    nav a {
      border-radius: 999px; min-width: 0; min-height: 44px;
      color: var(--ph-toolbar-nav);
      --mdc-text-button-label-text-color: var(--ph-toolbar-nav);
    }
    nav a.active {
      background: #fff; color: #0a3550;
      --mdc-text-button-label-text-color: #0a3550;
      box-shadow: 0 1px 2px rgba(6, 37, 54, 0.18);
    }
    .icon-chip,
    .lang-trigger {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      min-height: 44px; min-width: 44px;
      padding-block: 0; padding-inline: 12px;
      border: 1px solid rgba(183, 220, 226, 0.45); border-radius: 999px;
      background: rgba(255, 255, 255, 0.08); color: #fff;
      font: inherit; font-size: 14px; font-weight: 600;
      cursor: pointer;
    }
    .icon-chip { padding-inline: 10px; }
    .icon-chip mat-icon,
    .lang-trigger mat-icon { font-size: 20px; width: 20px; height: 20px; color: #7ec8d2; }
    .lang-trigger .caret { color: #b7dce2; }
    .icon-chip:hover,
    .lang-trigger:hover { border-color: #7ec8d2; background: rgba(255, 255, 255, 0.14); }
    .page { max-width: 1120px; margin: 0 auto; padding: 28px 20px 72px; }

    @media (max-width: 720px) {
      .topbar { padding-inline: 12px; min-height: 56px; gap: 6px; }
      .tag { display: none; }
      .brand { font-size: 15px; }
      .logo { width: 32px; height: 32px; border-radius: 8px; }
      .logo mat-icon { font-size: 18px; width: 18px; height: 18px; }
      .lang-label { display: none; }
      .lang-trigger { padding-inline: 10px; }
      .chrome { gap: 6px; }
      nav a {
        min-height: 40px;
        font-size: 13px;
        padding-inline: 10px;
      }
      .page { padding: 20px 14px 56px; }
    }
  `,
})
export class AppComponent {
  readonly i18n = inject(LanguageService);
  readonly theme = inject(ThemeService);
}
