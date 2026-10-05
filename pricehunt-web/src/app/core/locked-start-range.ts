import { Injectable, inject } from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { DateRange, MatDateRangeSelectionStrategy } from '@angular/material/datepicker';

/**
 * A chosen start stays put. A later click sets the end.
 * A day before the start is ignored until the range is cleared.
 */
@Injectable()
export class LockedStartRangeStrategy<D> implements MatDateRangeSelectionStrategy<D> {
  private readonly adapter = inject(DateAdapter) as DateAdapter<D>;

  selectionFinished(date: D | null, current: DateRange<D>): DateRange<D> {
    if (!date) return new DateRange(current.start, current.end);
    if (!current.start) return new DateRange(date, null);
    if (this.adapter.compareDate(date, current.start) < 0) return new DateRange(current.start, current.end);
    return new DateRange(current.start, date);
  }

  createPreview(activeDate: D | null, current: DateRange<D>): DateRange<D> {
    if (!current.start || current.end || !activeDate) return new DateRange<D>(null, null);
    if (this.adapter.compareDate(activeDate, current.start) < 0) return new DateRange<D>(null, null);
    return new DateRange(current.start, activeDate);
  }
}
