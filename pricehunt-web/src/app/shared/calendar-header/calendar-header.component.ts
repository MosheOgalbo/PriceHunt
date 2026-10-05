import { ChangeDetectionStrategy, Component, Injectable, ViewEncapsulation, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCalendarHeader } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { LanguageService } from '../../core/i18n/language.service';

/** Bridges the calendar header to the form that opened it. */
@Injectable()
export class CalendarClear {
  run: (() => void) | null = null;
}

/** Month header plus a clear-date action, so the range can be wiped from the calendar itself. */
@Component({
  selector: 'app-calendar-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="mat-calendar-header">
      <div class="mat-calendar-controls">
        <label [id]="periodLabelId" class="cdk-visually-hidden">{{ periodButtonDescription }}</label>
        <button mat-button type="button" class="mat-calendar-period-button"
                (click)="currentPeriodClicked()" [attr.aria-label]="periodButtonLabel"
                [attr.aria-describedby]="periodLabelId" aria-live="polite">
          <span aria-hidden="true">{{ periodButtonText }}</span>
          <svg class="mat-calendar-arrow" [class.mat-calendar-invert]="calendar.currentView !== 'month'"
               viewBox="0 0 10 5" focusable="false" aria-hidden="true">
            <polygon points="0,0 5,5 10,0"/>
          </svg>
        </button>
        <div class="mat-calendar-spacer"></div>
        <button mat-icon-button type="button" class="mat-calendar-previous-button"
                [disabled]="!previousEnabled()" (click)="previousClicked()"
                [attr.aria-label]="prevButtonLabel"></button>
        <button mat-icon-button type="button" class="mat-calendar-next-button"
                [disabled]="!nextEnabled()" (click)="nextClicked()"
                [attr.aria-label]="nextButtonLabel"></button>
      </div>
      <div class="ph-cal-clear">
        <button mat-button type="button" (click)="clear($event)">
          <mat-icon>event_busy</mat-icon>
          {{ clearLabel() }}
        </button>
      </div>
    </div>
  `,
})
export class PriceHuntCalendarHeader<D> extends MatCalendarHeader<D> {
  private readonly i18n = inject(LanguageService);
  private readonly bus = inject(CalendarClear);
  readonly periodLabelId = `ph-cal-${++headerSeq}`;
  readonly clearLabel = computed(() => this.i18n.t('clearDate'));

  clear(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.bus.run?.();
  }
}

let headerSeq = 0;

/**
 * The end date is written onto the input without refreshing the hidden mirror
 * that sizes the field, so the text stays clipped until the field is clicked.
 * Copy the input value into the mirror immediately.
 */
export function paintDateMirrors(root: ParentNode): void {
  root.querySelectorAll('.mat-date-range-input-wrapper').forEach(node => {
    const input = node.querySelector('input');
    const mirror = node.querySelector('.mat-date-range-input-mirror');
    if (!input || !mirror) return;
    mirror.textContent = input.value.length > 0 ? input.value : input.placeholder;
  });
}
