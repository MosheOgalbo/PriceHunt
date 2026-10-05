import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { HistoryFilter, HistoryItem } from '../../core/models';
import { toIsoDate } from '../../core/utils';

@Component({
  selector: 'app-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, DatePipe, DecimalPipe, CurrencyPipe,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule,
    MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatTooltipModule,
  ],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  private readonly api = inject(ApiService);
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

  readonly filters = new FormGroup({
    range: new FormGroup({
      start: new FormControl<Date | null>(null),
      end: new FormControl<Date | null>(null),
    }),
    suppliers: new FormControl<string[]>([], { nonNullable: true }),
    fromLocation: new FormControl('', { nonNullable: true }),
    toLocation: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.reload$
      .pipe(
        tap(() => { this.loading.set(true); this.error.set(null); }),
        switchMap(() =>
          this.api.history(this.currentFilter()).pipe(
            catchError(() => { this.error.set('Failed to load history'); return of(null); }),
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
    this.api.suppliers().subscribe(s => this.suppliers.set(s));
    this.reload$.next();
  }

  apply(): void { this.pageIndex.set(0); this.reload$.next(); }

  reset(): void { this.filters.reset(); this.apply(); }

  onSort(s: Sort): void {
    this.sortBy = s.active;
    this.sortDir = s.direction || 'desc';
    this.pageIndex.set(0);
    this.reload$.next();
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
      startDate: v.range.start ? toIsoDate(v.range.start) : undefined,
      endDate: v.range.end ? toIsoDate(v.range.end) : undefined,
      suppliers: v.suppliers,
      fromLocation: v.fromLocation.trim() || undefined,
      toLocation: v.toLocation.trim() || undefined,
      sortBy: this.sortBy,
      sortDir: this.sortDir,
      page: this.pageIndex() + 1,
      pageSize: this.pageSize(),
    };
  }
}
