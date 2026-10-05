import { Injectable, effect, inject } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { LanguageService } from './language.service';

@Injectable()
export class PriceHuntPaginatorIntl extends MatPaginatorIntl {
  private readonly i18n = inject(LanguageService);

  constructor() {
    super();
    effect(() => {
      this.i18n.lang();
      this.itemsPerPageLabel = this.i18n.t('itemsPerPage');
      this.nextPageLabel = this.i18n.t('nextPage');
      this.previousPageLabel = this.i18n.t('prevPage');
      this.firstPageLabel = this.i18n.t('firstPage');
      this.lastPageLabel = this.i18n.t('lastPage');
      this.getRangeLabel = (page, pageSize, length) => {
        if (length === 0 || pageSize === 0) return this.i18n.t('rangeEmpty', { length });
        const start = page * pageSize + 1;
        const end = Math.min((page + 1) * pageSize, length);
        return this.i18n.t('rangeLabel', { start, end, length });
      };
      this.changes.next();
    });
  }
}
