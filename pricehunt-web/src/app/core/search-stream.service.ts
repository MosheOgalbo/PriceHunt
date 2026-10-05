import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api.config';
import { SearchParams, StreamEvent } from './models';

@Injectable({ providedIn: 'root' })
export class SearchStreamService {
  /**
   * Cold observable over Server-Sent Events.
   * Each search has its own stream id. Closing the subscription is an explicit
   * cancel, so the server stops supplier work immediately. A dropped connection
   * leaves the EventSource to reconnect; the browser sends Last-Event-ID and
   * the server replays anything that was missed.
   */
  stream(p: SearchParams): Observable<StreamEvent> {
    const streamId = newStreamId();
    const qs = new URLSearchParams({
      fromLocation: p.fromLocation,
      toLocation: p.toLocation,
      fromDate: p.fromDate,
      toDate: p.toDate,
      streamId,
    });
    p.suppliers.forEach(s => qs.append('suppliers', s));
    const url = `${API_BASE}/search?${qs}`;

    return new Observable<StreamEvent>(subscriber => {
      const es = new EventSource(url);
      let settled = false;

      const fail = () => {
        if (settled) return;
        finish();
        subscriber.error(new Error('Connection to the server was lost'));
      };
      let watchdog = setTimeout(fail, 10_000);
      const touch = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(fail, 10_000);
      };

      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        es.close();
      };

      (['started', 'result', 'ended'] as const).forEach(type =>
        es.addEventListener(type, (event: Event) => {
          if (settled) return;
          touch();
          const data = JSON.parse((event as MessageEvent<string>).data);
          subscriber.next({ type, data } as StreamEvent);
          if (type === 'ended') {
            finish();
            subscriber.complete();
          }
        }),
      );

      es.onerror = () => {
        if (settled) return;
        // CONNECTING means the browser is already retrying with Last-Event-ID.
        if (es.readyState === EventSource.CONNECTING) return;
        finish();
        subscriber.error(new Error('Connection to the server was lost'));
      };

      return () => {
        const userCancelled = !settled;
        finish();
        if (userCancelled) {
          void fetch(`${API_BASE}/search/cancel?streamId=${encodeURIComponent(streamId)}`, {
            method: 'POST',
            keepalive: true,
          });
        }
      };
    });
  }
}

/** crypto.randomUUID is missing outside a secure context, such as a LAN IP. */
function newStreamId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 0x3) | 0x8).toString(16);
  });
}
