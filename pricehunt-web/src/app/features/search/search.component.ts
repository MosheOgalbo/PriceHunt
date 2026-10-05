import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { SearchParams, StreamEvent, SupplierResult } from '../../core/models';
import { isCurrentSearch } from '../../core/search-generation';
import { SearchStreamService } from '../../core/search-stream.service';
import { toIsoDate } from '../../core/utils';

type UiState = 'idle' | 'searching' | 'completed' | 'timedOut' | 'cancelled' | 'error';

/** Row height (64) + gap (12). Rows are absolutely positioned by index so reordering animates smoothly. */
const ROW_STEP = 76;

@Component({
  selector: 'app-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, CurrencyPipe, DecimalPipe,
    MatCardModule, MatFormFieldModule, MatInputModule, MatDatepickerModule,
    MatListModule, MatButtonModule, MatIconModule, MatProgressBarModule,
  ],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly stream = inject(SearchStreamService);
  private subscription?: Subscription;
  private generation = 0;

  readonly rowStep = ROW_STEP;
  readonly supplierNames = signal<string[]>([]);

  readonly form = new FormGroup({
    fromLocation: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    toLocation: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    range: new FormGroup({
      start: new FormControl<Date | null>(null, Validators.required),
      end: new FormControl<Date | null>(null, Validators.required),
    }),
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

  readonly statusLabel = computed(
    () =>
      ({
        idle: '',
        searching: 'Searching…',
        completed: 'Completed',
        timedOut: 'Timed out',
        cancelled: 'Cancelled',
        error: 'Connection error',
      })[this.state()],
  );

  ngOnInit(): void {
    this.api.suppliers().subscribe(names => {
      this.supplierNames.set(names);
      this.form.controls.suppliers.setValue(names);
    });
  }

  ngOnDestroy(): void {
    this.cancel(false);
  }

  selectAll(): void { this.form.controls.suppliers.setValue(this.supplierNames()); }
  clearAll(): void { this.form.controls.suppliers.setValue([]); }

  search(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const params: SearchParams = {
      fromLocation: v.fromLocation.trim(),
      toLocation: v.toLocation.trim(),
      fromDate: toIsoDate(v.range.start!),
      toDate: toIsoDate(v.range.end!),
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
        this.errorMessage.set(err.message);
      },
    });
  }

  cancel(markCancelled = true): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    if (markCancelled && this.isSearching()) this.state.set('cancelled');
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
