export type Lang = 'en' | 'he' | 'ru' | 'ar';

export const LANGUAGES: { id: Lang; native: string }[] = [
  { id: 'en', native: 'English' },
  { id: 'he', native: 'עברית' },
  { id: 'ru', native: 'Русский' },
  { id: 'ar', native: 'العربية' },
];

const STORAGE_KEY = 'pricehunt.language';

export function isLang(value: string | null): value is Lang {
  return value === 'en' || value === 'he' || value === 'ru' || value === 'ar';
}

export function initialLang(): Lang {
  if (typeof localStorage === 'undefined') return 'en';
  const saved = localStorage.getItem(STORAGE_KEY);
  return isLang(saved) ? saved : 'en';
}

export function rememberLang(lang: Lang): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, lang);
}

export function localeId(lang: Lang): string {
  return lang === 'en' ? 'en-US' : lang;
}

export function textDirection(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr';
}
