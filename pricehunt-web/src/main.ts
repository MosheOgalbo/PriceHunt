import { registerLocaleData } from '@angular/common';
import localeAr from '@angular/common/locales/ar';
import localeHe from '@angular/common/locales/he';
import localeRu from '@angular/common/locales/ru';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

registerLocaleData(localeHe, 'he');
registerLocaleData(localeRu, 'ru');
registerLocaleData(localeAr, 'ar');

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
