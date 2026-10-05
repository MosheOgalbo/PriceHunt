import { Directionality } from '@angular/cdk/bidi';
import { Injectable, effect, inject, signal } from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { Lang, LANGUAGES, initialLang, localeId, rememberLang, textDirection } from './language';
import { TRANSLATIONS } from './translations';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly dates = inject(DateAdapter<Date>, { optional: true });
  private readonly directionality = inject(Directionality);
  readonly languages = LANGUAGES;
  readonly lang = signal<Lang>(initialLang());

  constructor() {
    effect(() => {
      const lang = this.lang();
      const dir = textDirection(lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
      this.dates?.setLocale(localeId(lang));
      this.applyDirection(dir);
    });
  }

  locale(): string {
    return localeId(this.lang());
  }

  set(lang: Lang): void {
    this.lang.set(lang);
    rememberLang(lang);
  }

  current(): { id: Lang; native: string } {
    return LANGUAGES.find(language => language.id === this.lang()) ?? LANGUAGES[0];
  }

  /**
   * CDK reads `dir` once, before the saved language is applied, and gives every
   * popup that direction. The calendar then stays left-to-right while the page
   * is right-to-left, which turns its arrows backwards.
   */
  private applyDirection(dir: 'ltr' | 'rtl'): void {
    const bidi = this.directionality as Directionality & { value: 'ltr' | 'rtl' };
    if (bidi.value === dir) return;
    bidi.value = dir;
    bidi.change.emit(dir);
  }

  t(key: string, params?: Record<string, string | number>): string {
    const raw = TRANSLATIONS[this.lang()][key] ?? TRANSLATIONS.en[key] ?? key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''));
  }
}
