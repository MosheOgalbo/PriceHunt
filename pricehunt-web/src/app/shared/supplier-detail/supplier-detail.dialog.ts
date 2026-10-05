import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { LanguageService } from '../../core/i18n/language.service';
import { TrackingMapComponent } from '../tracking-map/tracking-map.component';
import { QuoteOutcome } from '../../core/models';

export interface SupplierDetailData {
  supplier: string;
  fromLocation: string;
  toLocation: string;
  fromDate: Date | string | null;
  toDate: Date | string | null;
  recordedAt: string | null;
  price: number | null;
  responseTimeMs: number | null;
  outcome: 'searching' | QuoteOutcome;
  error: string | null;
  seed: string;
}

@Component({
  selector: 'app-supplier-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, CurrencyPipe, DatePipe, DecimalPipe, TrackingMapComponent],
  template: `
    <h2 mat-dialog-title>
        <span class="logo"><mat-icon>local_shipping</mat-icon></span>
        <span class="brand">PriceHunt</span>
        <span class="topic">{{ i18n.t('supplierDetails') }}</span>
      </h2>
    <mat-dialog-content>
      <app-tracking-map
        [from]="data.fromLocation"
        [to]="data.toLocation"
        [seed]="data.seed"
        [progress]="data.outcome === 'ok' ? 1 : 0.4"
        [live]="data.outcome === 'searching'"
        [follow]="data.outcome !== 'searching'"
      />
      <p class="name">{{ data.supplier }}</p>
      <p class="status" [attr.data-outcome]="data.outcome">{{ status() }}</p>

      <dl>
        <div>
          <dt>{{ i18n.t('route') }}</dt>
          <dd>{{ data.fromLocation }} <span class="arrow">→</span> {{ data.toLocation }}</dd>
        </div>
        @if (data.fromDate || data.toDate) {
          <div>
            <dt>{{ i18n.t('dateRange') }}</dt>
            <dd class="ltr">
              {{ data.fromDate | date: 'dd/MM/yyyy' : undefined : i18n.locale() }}
              –
              {{ data.toDate | date: 'dd/MM/yyyy' : undefined : i18n.locale() }}
            </dd>
          </div>
        }
        @if (data.outcome === 'ok') {
          <div>
            <dt>{{ i18n.t('price') }}</dt>
            <dd class="price">{{ data.price | currency: 'USD' : 'symbol' : '1.2-2' : i18n.locale() }}</dd>
          </div>
        }
        @if (data.responseTimeMs !== null && data.outcome !== 'searching') {
          <div>
            <dt>{{ i18n.t('responseTime') }}</dt>
            <dd>{{ data.responseTimeMs / 1000 | number: '1.1-1' : i18n.locale() }} {{ i18n.t('secondsShort') }}</dd>
          </div>
        }
        @if (data.recordedAt) {
          <div>
            <dt>{{ i18n.t('date') }}</dt>
            <dd class="ltr">{{ data.recordedAt | date: 'dd/MM/yyyy HH:mm:ss' : undefined : i18n.locale() }}</dd>
          </div>
        }
        @if (data.error && data.outcome !== 'ok' && data.outcome !== 'searching') {
          <div>
            <dt>{{ i18n.t('failed') }}</dt>
            <dd>{{ data.error }}</dd>
          </div>
        }
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" mat-dialog-close>{{ i18n.t('close') }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    h2 { margin: 0; display: flex; align-items: center; gap: 10px; }
    .logo {
      width: 32px; height: 32px; border-radius: 8px; flex: none;
      display: grid; place-items: center; background: #3949ab;
    }
    .logo mat-icon { color: #fff; font-size: 18px; width: 18px; height: 18px; }
    .brand { font-weight: 700; }
    .topic { font-weight: 600; color: #3c465c; }
    .name { margin: 0; font-size: 20px; font-weight: 700; }
    .status {
      display: inline-block; margin: 8px 0 16px; padding: 4px 12px; border-radius: 999px;
      font-size: 12px; font-weight: 700; background: #e8eaf6; color: #3949ab;
      &[data-outcome='ok'] { background: #e6f4ea; color: #1e7e34; }
      &[data-outcome='failed'], &[data-outcome='noResponse'] { background: #fdecea; color: #b3261e; }
    }
    app-tracking-map { margin-bottom: 16px; }
    dl { margin: 0; display: grid; gap: 12px; }
    div { display: flex; justify-content: space-between; gap: 16px; }
    dt { color: #6b7590; }
    dd { margin: 0; font-weight: 650; text-align: end; }
    .price { font-size: 18px; }
    .ltr { direction: ltr; unicode-bidi: isolate; }
    .arrow { color: #9aa3b8; }
  `,
})
export class SupplierDetailDialog {
  readonly data = inject<SupplierDetailData>(MAT_DIALOG_DATA);
  readonly i18n = inject(LanguageService);

  status(): string {
    const outcome = this.data.outcome;
    if (outcome === 'searching') return this.i18n.t('onTheWay');
    if (outcome === 'ok') return this.i18n.t('completed');
    if (outcome === 'noResponse') return this.i18n.t('noResponse');
    return this.i18n.t('failed');
  }
}
