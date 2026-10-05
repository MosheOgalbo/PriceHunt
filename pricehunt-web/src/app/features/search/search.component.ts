import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MAT_DATE_RANGE_SELECTION_STRATEGY, MatDateRangePicker, MatDatepickerIntl, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { PriceHuntDatepickerIntl } from '../../core/i18n/datepicker-intl';
import { LanguageService } from '../../core/i18n/language.service';
import { SearchParams, StreamEvent, SupplierResult } from '../../core/models';
import { canonicalPlace, differentPlaceValidator, knownPlaceValidator, placeLabel } from '../../core/places';
import { isCurrentSearch } from '../../core/search-generation';
import { SearchStreamService } from '../../core/search-stream.service';
import { LockedStartRangeStrategy } from '../../core/locked-start-range';
import { trackingIds, supplierCode } from '../../core/tracking';
import { PlaceFieldComponent } from '../../shared/place-field/place-field.component';
import { SupplierDetailDialog } from '../../shared/supplier-detail/supplier-detail.dialog';
import { TrackingMapComponent } from '../../shared/tracking-map/tracking-map.component';
import { CalendarClear, PriceHuntCalendarHeader, paintDateMirrors } from '../../shared/calendar-header/calendar-header.component';
import { endNotBeforeStart, notInPast, startOfDay, toIsoDate, todayStart } from '../../core/utils';

type UiState = 'idle' | 'searching' | 'completed' | 'timedOut' | 'cancelled' | 'error';

interface ResultSlot {
  supplier: string;
  result: SupplierResult | null;
}

/** Row height (72) + gap (12). Rows are absolutely positioned by index so reordering animates smoothly. */
const ROW_STEP = 84;

@Component({
  selector: 'app-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, CurrencyPipe, DecimalPipe,
    MatCardModule, MatFormFieldModule, MatInputModule, MatDatepickerModule,
    MatButtonModule, MatCheckboxModule, MatIconModule, MatSelectModule, MatProgressBarModule, MatDialogModule,
    PlaceFieldComponent, TrackingMapComponent,
  ],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
  providers: [
    CalendarClear,
    { provide: MatDatepickerIntl, useClass: PriceHuntDatepickerIntl },
    { provide: MAT_DATE_RANGE_SELECTION_STRATEGY, useClass: LockedStartRangeStrategy },
  ],
})
export class SearchComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly stream = inject(SearchStreamService);
  private readonly dialog = inject(MatDialog);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly i18n = inject(LanguageService);
  private readonly calendarClear = inject(CalendarClear);
  readonly calendarHeader = PriceHuntCalendarHeader;
  @ViewChild(FormGroupDirective) private formDirective?: FormGroupDirective;
  @ViewChild('picker') private picker?: MatDateRangePicker<Date>;
  private subscription?: Subscription;
  private generation = 0;

  readonly rowStep = ROW_STEP;
  readonly supplierNames = signal<string[]>([]);

  readonly submitted = signal(false);
  readonly form = new FormGroup({
    fromLocation: new FormControl('', { nonNullable: true, validators: [Validators.required, knownPlaceValidator()] }),
    toLocation: new FormControl('', { nonNullable: true, validators: [Validators.required, knownPlaceValidator(), differentPlaceValidator()] }),
    fromDate: new FormControl<Date | null>(null, [Validators.required, notInPast()]),
    toDate: new FormControl<Date | null>(null, [Validators.required, notInPast(), endNotBeforeStart()]),
    suppliers: new FormControl<string[]>([], { nonNullable: true, validators: [Validators.required] }),
  });

  readonly state = signal<UiState>('idle');
  readonly results = signal<SupplierResult[]>([]);
  readonly queried = signal<string[]>([]);
  readonly errorMessage = signal<string | null>(null);

  readonly isSearching = computed(() => this.state() === 'searching');
  readonly answered = computed(() => this.results().filter(r => r.outcome !== 'noResponse').length);
  readonly total = computed(() => this.queried().length);
  readonly progress = computed(() => (this.total() ? (this.answered() / this.total()) * 100 : 0));
  readonly bestPrice = computed(() => this.sorted().find(r => r.succeeded)?.price ?? null);
  /** 0 at the start of the road, 1 when every supplier result is on screen. */
  readonly travel = computed(() => {
    const total = this.total();
    if (!total) return 0;
    return Math.min(1, this.results().length / total);
  });

  readonly sorted = computed(() =>
    [...this.results()].sort(
      (a, b) =>
        this.outcomeRank(a) - this.outcomeRank(b) ||
        (a.price ?? 0) - (b.price ?? 0) ||
        a.responseTimeMs - b.responseTimeMs,
    ),
  );

  readonly pending = computed(() => {
    const done = new Set(this.results().map(r => r.supplier));
    return this.queried().filter(n => !done.has(n));
  });

  /** Priced rows first, still-searching suppliers after them. The same supplier keeps one row. */
  readonly slots = computed((): ResultSlot[] => [
    ...this.sorted().map(result => ({ supplier: result.supplier, result })),
    ...this.pending().map(supplier => ({ supplier, result: null })),
  ]);

  readonly statusLabel = computed(() => {
    const state = this.state();
    if (state === 'idle') return '';
    if (state === 'completed') return this.i18n.t('completed');
    return this.i18n.t(state === 'error' ? 'connectionError' : state);
  });

  ngOnInit(): void {
    this.calendarClear.run = () => {
      this.clearDates();
      this.picker?.close();
    };
    this.api.suppliers().subscribe(names => {
      this.supplierNames.set(names);
      this.form.controls.suppliers.setValue(names);
    });
    this.form.controls.fromDate.valueChanges.subscribe(start => {
      this.rangeStart.set(start);
      const end = this.form.controls.toDate;
      if (start && end.value && startOfDay(end.value) < startOfDay(start)) end.setValue(null);
      end.updateValueAndValidity({ emitEvent: false });
    });
    this.form.controls.fromLocation.valueChanges.subscribe(() => {
      this.form.controls.toLocation.updateValueAndValidity({ emitEvent: false });
    });
  }

  ngOnDestroy(): void {
    this.cancel(false);
  }

  supplierLabel(): string {
    const selected = this.form.controls.suppliers.value;
    const total = this.supplierNames().length;
    if (selected.length === 0) return '';
    if (total > 0 && selected.length === total) return this.i18n.t('multipleSelection');
    if (selected.length === 1) return selected[0];
    return this.i18n.t('supplierCount', { count: selected.length });
  }

  allSelected(): boolean {
    const names = this.supplierNames();
    return names.length > 0 && this.form.controls.suppliers.value.length === names.length;
  }

  someSelected(): boolean {
    const count = this.form.controls.suppliers.value.length;
    return count > 0 && count < this.supplierNames().length;
  }

  setAll(selected: boolean): void {
    this.form.controls.suppliers.setValue(selected ? [...this.supplierNames()] : []);
    this.form.controls.suppliers.markAsTouched();
  }

  clearSuppliers(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.setAll(false);
  }

  private readonly rangeStart = signal<Date | null>(null);
  /** Today onward; end date also cannot precede the chosen start. */
  readonly liveDateFilter = computed(() => {
    const start = this.rangeStart();
    const today = todayStart();
    return (date: Date | null): boolean => {
      if (!date) return false;
      const day = startOfDay(date);
      if (day < today) return false;
      if (start && day < startOfDay(start)) return false;
      return true;
    };
  });

  clearDates(): void {
    this.form.controls.fromDate.setValue(null);
    this.form.controls.toDate.setValue(null);
    this.form.controls.fromDate.markAsTouched();
    this.paintDates();
  }

  /** Show a calendar selection at full width without waiting for a click in the field. */
  paintDates(): void {
    paintDateMirrors(this.host.nativeElement);
  }

  /** Wipe the form and any results. Suppliers return to the default: all selected. */
  clearSearch(): void {
    this.cancel(false);
    this.generation++;
    this.submitted.set(false);
    this.results.set([]);
    this.queried.set([]);
    this.errorMessage.set(null);
    this.state.set('idle');
    this.rangeStart.set(null);
    this.formDirective?.resetForm({
      fromLocation: '',
      toLocation: '',
      fromDate: null,
      toDate: null,
      suppliers: this.supplierNames(),
    });
  }

  search(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    this.form.controls.toDate.updateValueAndValidity();
    this.form.controls.toLocation.updateValueAndValidity();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const params: SearchParams = {
      fromLocation: canonicalPlace(v.fromLocation),
      toLocation: canonicalPlace(v.toLocation),
      fromDate: toIsoDate(v.fromDate!),
      toDate: toIsoDate(v.toDate!),
      suppliers: v.suppliers,
    };

    this.cancel(false);
    const generation = ++this.generation;
    this.results.set([]);
    this.queried.set(params.suppliers);
    this.errorMessage.set(null);
    this.state.set('searching');

    this.subscription = this.stream.stream(params).subscribe({
      next: ev => this.onEvent(generation, ev),
      error: (err: Error) => {
        if (generation !== this.generation) return;
        this.state.set('error');
        this.errorMessage.set(this.i18n.t('connectionError'));
      },
    });
    this.revealResults();
  }

  private revealResults(): void {
    const align = () => {
      const panel = this.host.nativeElement.querySelector('.results');
      panel?.scrollIntoView({ behavior: 'auto', block: 'start' });
    };
    // The results panel is created on the next change-detection turn, after this click.
    setTimeout(align);
    setTimeout(align, 50);
  }

  cancel(markCancelled = true): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    if (markCancelled && this.isSearching()) this.state.set('cancelled');
  }

  waybill(): string {
    return trackingIds(this.trackSeed()).waybill;
  }

  supplierId(name: string): string {
    return supplierCode(name);
  }

  /** One shipment reference for the whole search — shared across every supplier quote. */
  trackSeed(): string {
    const v = this.form.getRawValue();
    const from = v.fromDate ? toIsoDate(v.fromDate) : '';
    const to = v.toDate ? toIsoDate(v.toDate) : '';
    return `${v.fromLocation}|${v.toLocation}|${from}|${to}`;
  }

  openSupplier(slot: ResultSlot): void {
    const from = this.form.controls.fromLocation.value;
    const to = this.form.controls.toLocation.value;
    const result = slot.result;
    this.dialog.open(SupplierDetailDialog, {
      width: '640px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'dialog',
      data: {
        supplier: slot.supplier,
        fromLocation: placeLabel(from, this.i18n.lang()),
        toLocation: placeLabel(to, this.i18n.lang()),
        fromDate: this.form.controls.fromDate.value,
        toDate: this.form.controls.toDate.value,
        recordedAt: result?.receivedAtUtc ?? null,
        price: result?.price ?? null,
        responseTimeMs: result?.responseTimeMs ?? null,
        outcome: result?.outcome ?? 'searching',
        error: result && !result.succeeded ? this.detail(result) : null,
        seed: this.trackSeed(),
      },
    });
  }

  detail(r: SupplierResult): string {
    if (r.succeeded) {
      const seconds = (r.responseTimeMs / 1000).toLocaleString(this.i18n.locale(), {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      return this.i18n.t('respondedIn', { seconds });
    }
    if (r.outcome === 'noResponse' || (r.error ?? '').toLowerCase().includes('no response')) {
      return this.i18n.t('noResponseDetail');
    }
    if ((r.error ?? '').includes('temporarily unavailable')) {
      return this.i18n.t('supplierUnavailable', { name: r.supplier });
    }
    if ((r.error ?? '').includes('temporarily skipped')) return this.i18n.t('circuitOpen');
    return r.error ?? this.i18n.t('failed');
  }

  private outcomeRank(r: SupplierResult): number {
    if (r.succeeded) return 0;
    return r.outcome === 'noResponse' ? 2 : 1;
  }

  private onEvent(generation: number, ev: StreamEvent): void {
    if (!isCurrentSearch(generation, this.generation)) return;
    if (ev.type === 'result') {
      this.results.update(list =>
        list.some(r => r.supplier === ev.data.supplier) ? list : [...list, ev.data],
      );
    } else if (ev.type === 'ended') {
      this.state.set(ev.data.status);
    }
  }
}
