import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { LanguageService } from '../../core/i18n/language.service';
import { TrackingMapComponent } from '../tracking-map/tracking-map.component';
import { QuoteOutcome } from '../../core/models';
import { supplierCode } from '../../core/tracking';

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
        [supplier]="data.supplier"
        [progress]="progress()"
        [live]="driving()"
        [follow]="true"
        [caption]="caption()"
      />
      <p class="name">{{ data.supplier }}</p>
      <p class="status" [attr.data-outcome]="data.outcome">{{ status() }}</p>

      <dl>
        <div>
          <dt>{{ i18n.t('supplierId') }}</dt>
          <dd class="ltr">{{ supplierId }}</dd>
        </div>
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
      display: grid; place-items: center; background: var(--ph-logo-bg, #fff);
      border: 1px solid var(--ph-line, #d3dde5);
    }
    .logo mat-icon { color: var(--ph-logo-fg, #0a3550); font-size: 18px; width: 18px; height: 18px; }
    .brand { font-weight: 700; color: var(--ph-heading, #0a3550); }
    .topic { font-weight: 600; color: var(--ph-muted, #5a6b78); }
    .name { margin: 0; font-size: 20px; font-weight: 700; color: var(--ph-heading, #0a3550); }
    .status {
      display: inline-block; margin: 8px 0 16px; padding: 4px 12px; border-radius: 999px;
      font-size: 12px; font-weight: 700; background: var(--ph-sea-soft, #e4f3f5); color: var(--ph-navy, #0a3550);
      &[data-outcome='ok'] { background: var(--ph-ok-soft, #e6f4ea); color: var(--ph-ok, #146c36); }
      &[data-outcome='noResponse'] { background: var(--ph-warn-soft, #fff1d6); color: var(--ph-warn, #8a5a00); }
      &[data-outcome='failed'] { background: var(--ph-danger-soft, #fdecea); color: var(--ph-danger, #b3261e); }
    }
    app-tracking-map { margin-bottom: 16px; }
    dl { margin: 0; display: grid; gap: 0; border: 1px solid var(--ph-line, #d3dde5); border-radius: 12px; overflow: hidden; }
    dl > div {
      display: flex; justify-content: space-between; gap: 16px;
      padding: 12px 14px; background: var(--ph-surface, #fff);
    }
    dl > div + div { border-top: 1px solid var(--ph-line-soft, #e8eef2); }
    dt { color: var(--ph-muted, #5a6b78); font-weight: 600; }
    dd { margin: 0; font-weight: 700; text-align: end; color: var(--ph-ink, #12202b); }
    .price { font-size: 18px; font-variant-numeric: tabular-nums; color: var(--ph-heading, #0a3550); }
    .ltr { direction: ltr; unicode-bidi: isolate; }
    .arrow { color: var(--ph-muted, #9aa3b8); }
  `,
})
export class SupplierDetailDialog implements OnInit, OnDestroy {
  readonly data = inject<SupplierDetailData>(MAT_DIALOG_DATA);
  readonly i18n = inject(LanguageService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly supplierId = supplierCode(this.data.supplier);
  /** Green → destination, orange → middle, red/waiting → origin. */
  readonly progress = signal(0);
  readonly driving = signal(false);
  private timer?: number;

  ngOnInit(): void {
    const target = this.targetProgress();
    if (target <= 0) return;
    this.driving.set(true);
    this.timer = window.setInterval(() => {
      const next = Math.min(target, this.progress() + 0.04);
      this.progress.set(next);
      this.cdr.markForCheck();
      if (next >= target) {
        this.driving.set(false);
        this.stop();
      }
    }, 80);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  status(): string {
    const outcome = this.data.outcome;
    if (outcome === 'searching') return this.i18n.t('awaitingQuote');
    if (outcome === 'ok') return this.i18n.t('quoteReceived');
    if (outcome === 'noResponse') return this.i18n.t('noResponse');
    return this.i18n.t('failed');
  }

  caption(): string {
    const outcome = this.data.outcome;
    if (outcome === 'ok') {
      return this.progress() >= 0.98 ? this.i18n.t('arrived') : this.i18n.t('onTheWay');
    }
    if (outcome === 'noResponse') return this.i18n.t('noResponseDetail');
    if (outcome === 'failed') return this.i18n.t('failed');
    return this.i18n.t('awaitingQuote');
  }

  private targetProgress(): number {
    if (this.data.outcome === 'ok') return 1;
    if (this.data.outcome === 'noResponse') return 0.5;
    return 0;
  }

  private stop(): void {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = undefined;
  }
}
