import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LanguageService } from '../../core/i18n/language.service';
import { placeLabel } from '../../core/places';
import { routeLayout, trackingIds } from '../../core/tracking';

/** Live shipment map: the truck drives the road from origin to destination. */
@Component({
  selector: 'app-tracking-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <section class="track">
      <header>
        <div>
          <p class="kicker">{{ i18n.t('trackingNumber') }} · {{ i18n.t('waybill') }}</p>
          <p class="waybill ltr">{{ ids.waybill }}</p>
        </div>
        <div class="meta">
          <span><em>{{ i18n.t('shipmentId') }}</em><b class="ltr">{{ ids.shipmentId }}</b></span>
          <span><em>{{ i18n.t('licensePlate') }}</em><b class="ltr">{{ ids.plate }}</b></span>
        </div>
      </header>
      <div class="map" role="img" [attr.aria-label]="i18n.t('liveMap')">
        <svg [attr.viewBox]="'0 0 ' + layout.width + ' ' + layout.height" aria-hidden="true">
          <rect width="100%" height="100%" fill="#d5e4ec" />
          <g class="grid" stroke="#c5d5de">
            <path d="M0 70 H640 M0 140 H640 M0 210 H640 M160 0 V280 M320 0 V280 M480 0 V280" />
          </g>
          <ellipse cx="120" cy="200" rx="150" ry="70" fill="#e7f0e4" />
          <ellipse cx="470" cy="90" rx="180" ry="78" fill="#e4efe2" />
          <ellipse cx="300" cy="230" rx="90" ry="36" fill="#edf3ea" />
          <path class="casing" [attr.d]="layout.road" />
          <path class="route" [attr.d]="layout.road" />
          <g [attr.transform]="'translate(' + layout.from.x + ' ' + layout.from.y + ')'">
            <circle r="7" fill="#1e8e3e" />
            <text class="city" y="-14">{{ fromLabel }}</text>
          </g>
          <g [attr.transform]="'translate(' + layout.to.x + ' ' + layout.to.y + ')'">
            <circle r="7" fill="#d93025" />
            <text class="city" y="-14">{{ toLabel }}</text>
          </g>
        </svg>
        <span
          class="truck"
          [class.driving]="driving"
          [style.left.%]="(layout.truck.x / layout.width) * 100"
          [style.top.%]="(layout.truck.y / layout.height) * 100"
          [style.transform]="'translate(-50%, -50%) rotate(' + layout.truck.angle + 'deg)'"
        >
          <mat-icon>local_shipping</mat-icon>
        </span>
      </div>
      <p class="note" [class.done]="!caption && shown >= 0.98">
        <mat-icon>{{ caption ? 'alt_route' : (shown < 0.98 ? 'local_shipping' : 'where_to_vote') }}</mat-icon>
        {{ caption || (shown < 0.98 ? i18n.t('onTheWay') : i18n.t('arrived')) }}
      </p>
    </section>
  `,
  styles: `
    :host { display: block; }
    .track {
      display: grid; gap: 12px; padding: 14px;
      border: 1px solid #e4e8f2; border-radius: 16px; background: #f8f9fc;
    }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-end; flex-wrap: wrap; }
    .kicker { margin: 0; color: #6b7590; font-size: 12px; font-weight: 700; }
    .waybill {
      margin: 2px 0 0; font-size: 22px; font-weight: 800; letter-spacing: 0.04em; color: #1c2434;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .ltr { direction: ltr; unicode-bidi: isolate; }
    .meta { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
    .meta span { display: flex; gap: 8px; align-items: baseline; }
    .meta em { color: #6b7590; font-style: normal; font-weight: 600; }
    .meta b { font-weight: 800; }
    .map {
      position: relative; direction: ltr; border-radius: 12px; overflow: hidden;
      box-shadow: inset 0 0 0 1px #c5d5de;
    }
    svg { display: block; width: 100%; height: auto; }
    .grid { fill: none; stroke-width: 1; }
    .casing { fill: none; stroke: #fff; stroke-width: 12; stroke-linecap: round; }
    .route { fill: none; stroke: #3949ab; stroke-width: 4; stroke-linecap: round; }
    .city { font-size: 13px; font-weight: 700; fill: #1c2434; text-anchor: middle; }
    .truck {
      position: absolute; width: 36px; height: 36px; border-radius: 10px;
      display: grid; place-items: center; background: #3949ab; color: #fff;
      box-shadow: 0 8px 16px rgba(28, 36, 52, 0.28);
      transition: left 0.8s linear, top 0.8s linear, transform 0.8s linear;
    }
    .truck mat-icon { color: #fff; font-size: 20px; width: 20px; height: 20px; }
    .truck.driving { animation: bob 0.7s ease-in-out infinite; }
    .note {
      margin: 0; display: flex; align-items: center; gap: 8px;
      color: #3949ab; font-weight: 700;
    }
    .note mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .note.done { color: #146c36; }
    @keyframes bob {
      0%, 100% { margin-top: 0; }
      50% { margin-top: -3px; }
    }
  `,
})
export class TrackingMapComponent implements OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  readonly i18n = inject(LanguageService);

  @Input() from = '';
  @Input() to = '';
  @Input() seed = '';
  /** 0 at the origin, 1 at the destination. */
  @Input() progress = 0;
  /** Keep gliding while the shipment is still on the road. */
  @Input() live = false;
  /** When set, the truck follows progress instead of gliding on its own. */
  @Input() follow = false;
  /** Replaces the driving status. Used when the map shows a route to price, not a finished shipment. */
  @Input() caption = '';

  private glide = 0.08;
  private timer?: number;

  get ids() {
    return trackingIds(this.seed || `${this.from}|${this.to}`);
  }

  get fromLabel(): string {
    return placeLabel(this.from, this.i18n.lang());
  }

  get toLabel(): string {
    return placeLabel(this.to, this.i18n.lang());
  }

  get driving(): boolean {
    return this.live && this.shown < 0.98;
  }

  get shown(): number {
    return this.follow || !this.live ? this.progress : this.glide;
  }

  get layout() {
    return routeLayout(this.from, this.to, this.shown);
  }

  ngOnChanges(): void {
    if (this.follow || !this.live) {
      this.stop();
      return;
    }
    if (this.timer) return;
    this.glide = Math.max(this.glide, 0.08);
    this.timer = window.setInterval(() => {
      this.glide = Math.min(0.92, this.glide + 0.018);
      this.cdr.markForCheck();
      if (this.glide >= 0.92) this.stop();
    }, 240);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private stop(): void {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = undefined;
  }
}
