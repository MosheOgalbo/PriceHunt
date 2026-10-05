import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MAT_DATE_RANGE_SELECTION_STRATEGY, MatDatepickerIntl, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { PriceHuntDatepickerIntl } from '../../core/i18n/datepicker-intl';
import { LanguageService } from '../../core/i18n/language.service';
import { PriceHuntPaginatorIntl } from '../../core/i18n/paginator-intl';
import { HistoryFilter, HistoryItem } from '../../core/models';
import { canonicalPlace, differentPlaceValidator, knownPlaceValidator, placeLabel } from '../../core/places';
import { LockedStartRangeStrategy } from '../../core/locked-start-range';
import { PlaceFieldComponent } from '../../shared/place-field/place-field.component';
import { SupplierDetailDialog } from '../../shared/supplier-detail/supplier-detail.dialog';
import { endNotBeforeStart, startOfDay, toIsoDate } from '../../core/utils';

@Component({
  selector: 'app-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, DatePipe, DecimalPipe, CurrencyPipe,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule,
    MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatTooltipModule, MatDialogModule, PlaceFieldComponent,
  ],
  providers: [
    { provide: MatPaginatorIntl, useClass: PriceHuntPaginatorIntl },
    { provide: MatDatepickerIntl, useClass: PriceHuntDatepickerIntl },
    { provide: MAT_DATE_RANGE_SELECTION_STRATEGY, useClass: LockedStartRangeStrategy },
  ],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  readonly i18n = inject(LanguageService);
  private readonly reload$ = new Subject<void>();

  readonly columns = ['date', 'route', 'supplier', 'price', 'responseTime'];
  readonly suppliers = signal<string[]>([]);
  readonly rows = signal<HistoryItem[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  private sortBy = 'date';
  private sortDir: 'asc' | 'desc' = 'desc';

  readonly submitted = signal(false);
  readonly filters = new FormGroup({
    fromDate: new FormControl<Date | null>(null, Validators.required),
    toDate: new FormControl<Date | null>(null, [Validators.required, endNotBeforeStart()]),
    suppliers: new FormControl<string[]>([], { nonNullable: true, validators: [Validators.required] }),
    fromLocation: new FormControl('', { nonNullable: true, validators: [Validators.required, knownPlaceValidator()] }),
    toLocation: new FormControl('', { nonNullable: true, validators: [Validators.required, knownPlaceValidator(), differentPlaceValidator()] }),
  });

  constructor() {
    this.reload$
      .pipe(
        tap(() => { this.loading.set(true); this.error.set(null); }),
        switchMap(() =>
          this.api.history(this.currentFilter()).pipe(
            catchError(() => { this.error.set(this.i18n.t('loadError')); return of(null); }),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(res => {
        this.loading.set(false);
        if (res) { this.rows.set(res.items); this.total.set(res.total); }
      });
  }

  ngOnInit(): void {
    this.api.suppliers().subscribe(names => {
      this.suppliers.set(names);
      this.filters.controls.suppliers.setValue(names);
    });
    this.filters.controls.fromDate.valueChanges.subscribe(start => {
      this.rangeStart.set(start);
      const end = this.filters.controls.toDate;
      if (start && end.value && startOfDay(end.value) < startOfDay(start)) end.setValue(null);
      end.updateValueAndValidity({ emitEvent: false });
    });
    this.filters.controls.fromLocation.valueChanges.subscribe(() => {
      this.filters.controls.toLocation.updateValueAndValidity({ emitEvent: false });
    });
    this.reload$.next();
  }

  private readonly rangeStart = signal<Date | null>(null);
  readonly blockBeforeStart = computed(() => {
    const start = this.rangeStart();
    return (date: Date | null): boolean => !start || !date || startOfDay(date) >= startOfDay(start);
  });

  supplierLabel(): string {
    const selected = this.filters.controls.suppliers.value;
    if (selected.length === 0) return '';
    if (selected.length === 1) return selected[0];
    return this.i18n.t('supplierCount', { count: selected.length });
  }

  clearSuppliers(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.filters.controls.suppliers.setValue([]);
    this.filters.controls.suppliers.markAsTouched();
  }

  clearDates(): void {
    this.filters.controls.fromDate.setValue(null);
    this.filters.controls.toDate.setValue(null);
  }

  apply(): void {
    this.submitted.set(true);
    this.filters.markAllAsTouched();
    this.filters.controls.toDate.updateValueAndValidity();
    this.filters.controls.toLocation.updateValueAndValidity();
    if (this.filters.invalid) return;
    this.pageIndex.set(0);
    this.reload$.next();
  }

  reset(): void {
    this.submitted.set(false);
    this.filters.reset({
      fromDate: null,
      toDate: null,
      suppliers: this.suppliers(),
      fromLocation: '',
      toLocation: '',
    });
    this.pageIndex.set(0);
    this.reload$.next();
  }

  onSort(s: Sort): void {
    this.sortBy = s.active;
    this.sortDir = s.direction || 'desc';
    this.pageIndex.set(0);
    this.reload$.next();
  }

  routePlace(name: string): string {
    return placeLabel(name, this.i18n.lang());
  }

  openSupplier(row: HistoryItem): void {
    this.dialog.open(SupplierDetailDialog, {
      width: '640px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'dialog',
      data: {
        supplier: row.supplier,
        fromLocation: this.routePlace(row.fromLocation),
        toLocation: this.routePlace(row.toLocation),
        fromDate: null,
        toDate: null,
        recordedAt: row.timestampUtc,
        price: row.price,
        responseTimeMs: row.responseTimeMs,
        outcome: row.succeeded ? 'ok' : this.isNoResponse(row) ? 'noResponse' : 'failed',
        error: row.succeeded ? null : row.error,
        seed: `${row.supplier}|${row.fromLocation}|${row.toLocation}|${row.timestampUtc}`,
      },
    });
  }

  isNoResponse(r: HistoryItem): boolean {
    return !r.succeeded && (r.error ?? '').toLowerCase().includes('no response');
  }

  onPage(e: PageEvent): void {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    this.reload$.next();
  }

  private currentFilter(): HistoryFilter {
    const v = this.filters.getRawValue();
    return {
      startDate: v.fromDate ? toIsoDate(v.fromDate) : undefined,
      endDate: v.toDate ? toIsoDate(v.toDate) : undefined,
      suppliers: v.suppliers,
      fromLocation: v.fromLocation.trim() ? canonicalPlace(v.fromLocation) : undefined,
      toLocation: v.toLocation.trim() ? canonicalPlace(v.toLocation) : undefined,
      sortBy: this.sortBy,
      sortDir: this.sortDir,
      page: this.pageIndex() + 1,
      pageSize: this.pageSize(),
    };
  }
}
