import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Input, OnInit, Optional, Self, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormControl, NgControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { LanguageService } from '../../core/i18n/language.service';
import { Place, canonicalPlace, countryName, filterPlaces, findPlace } from '../../core/places';

@Component({
  selector: 'app-place-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatAutocompleteModule, MatIconModule],
  template: `
    <mat-form-field appearance="outline" class="field" subscriptSizing="dynamic" floatLabel="always">
      <mat-label>{{ label }}</mat-label>
      <mat-icon matIconPrefix>{{ icon }}</mat-icon>
      <input
        matInput
        [formControl]="inner"
        [matAutocomplete]="auto"
        [placeholder]="placeholder"
        [required]="required"
        [errorStateMatcher]="matcher"
        (blur)="commit()"
        autocomplete="off"
      />
      <mat-autocomplete
        #auto="matAutocomplete"
        class="place-panel"
        [panelWidth]="520"
        [displayWith]="display"
        autoActiveFirstOption
        (optionSelected)="pick($event.option.value)"
      >
        <mat-option disabled class="place-head">
          <span class="place-row">
            <span>{{ i18n.t('city') }}</span>
            <span>{{ i18n.t('country') }}</span>
            <span>{{ i18n.t('locode') }}</span>
          </span>
        </mat-option>
        @for (place of matches(); track place.locode) {
          <mat-option [value]="place.city.en">
            <span class="place-row">
              <span class="city">{{ place.city[i18n.lang()] }}</span>
              <span class="country">{{ country(place) }}</span>
              <span class="locode">{{ place.locode }}</span>
            </span>
          </mat-option>
        } @empty {
          <mat-option disabled>{{ i18n.t('noPlaces') }}</mat-option>
        }
      </mat-autocomplete>
      @if (showError) {
        <mat-error>{{ errorMessage() }}</mat-error>
      }
    </mat-form-field>
  `,
  styles: `
    :host { display: block; }
    .field { width: 100%; }
  `,
})
export class PlaceFieldComponent implements ControlValueAccessor, OnInit {
  readonly i18n = inject(LanguageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The input's own control only knows "required". Parent validators (known place,
   * different places) live on NgControl, so Material must read that control.
   */
  readonly matcher: ErrorStateMatcher = {
    isErrorState: () => this.showError,
  };

  @Input() label = '';
  @Input() icon = 'place';
  @Input() placeholder = '';
  @Input() required = false;
  /** Set after the parent form is submitted, so an untouched field still shows its error. */
  @Input() showErrors = false;

  readonly inner = new FormControl('', { nonNullable: true });
  private readonly query = signal('');
  readonly matches = computed(() => {
    const query = this.query();
    const lang = this.i18n.lang();
    const selected = findPlace(query);
    if (selected && selected.city.en === query) return filterPlaces('', lang);
    return filterPlaces(query, lang);
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor(@Optional() @Self() private readonly control: NgControl | null) {
    if (this.control) this.control.valueAccessor = this;
    this.inner.valueChanges.subscribe(value => {
      this.query.set(value);
      this.onChange(value);
    });
    effect(() => {
      this.i18n.lang();
      this.inner.setValue(this.inner.value, { emitEvent: false });
    });
  }

  ngOnInit(): void {
    this.control?.statusChanges?.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cdr.markForCheck());
  }

  get showError(): boolean {
    return !!this.control?.invalid && (!!this.control.touched || this.showErrors);
  }

  errorMessage(): string {
    if (this.control?.hasError('unknownPlace')) return this.i18n.t('unknownPlace');
    if (this.control?.hasError('samePlace')) return this.i18n.t('samePlace');
    return this.i18n.t('required');
  }

  country(place: Place): string {
    return countryName(place.country, this.i18n.lang());
  }

  display = (value: string | null): string => {
    if (!value) return '';
    const match = findPlace(value);
    return match && match.city.en === value ? match.city[this.i18n.lang()] : value;
  };

  writeValue(value: string | null): void {
    const next = value ?? '';
    this.query.set(next);
    this.inner.setValue(next, { emitEvent: false });
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    if (disabled) this.inner.disable({ emitEvent: false });
    else this.inner.enable({ emitEvent: false });
  }

  pick(value: string): void {
    this.inner.setValue(value);
    this.onTouched();
  }

  commit(): void {
    const next = canonicalPlace(this.inner.value);
    if (next !== this.inner.value) this.inner.setValue(next);
    this.onTouched();
  }
}
