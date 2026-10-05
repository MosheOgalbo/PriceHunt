import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'pricehunt.theme';

function initialTheme(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'light';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(initialTheme());

  constructor() {
    this.apply(this.mode());
    effect(() => this.apply(this.mode()));
  }

  toggle(): void {
    this.mode.update(m => (m === 'light' ? 'dark' : 'light'));
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  isDark(): boolean {
    return this.mode() === 'dark';
  }

  private apply(mode: ThemeMode): void {
    document.documentElement.dataset['theme'] = mode;
    document.documentElement.style.colorScheme = mode;
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, mode);
  }
}
