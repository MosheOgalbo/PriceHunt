import { Injectable, effect, inject } from '@angular/core';
import { MatDatepickerIntl } from '@angular/material/datepicker';
import { LanguageService } from './language.service';

/** Calendar arrow labels follow the active language. */
@Injectable()
export class PriceHuntDatepickerIntl extends MatDatepickerIntl {
  private readonly i18n = inject(LanguageService);

  constructor() {
    super();
    effect(() => {
      this.i18n.lang();
      this.prevMonthLabel = this.i18n.t('prevMonth');
      this.nextMonthLabel = this.i18n.t('nextMonth');
      this.prevYearLabel = this.i18n.t('prevYear');
      this.nextYearLabel = this.i18n.t('nextYear');
      this.changes.next();
    });
  }
}
