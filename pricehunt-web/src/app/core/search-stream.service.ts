import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api.config';
import { SearchParams, StreamEvent } from './models';

@Injectable({ providedIn: 'root' })
export class SearchStreamService {
  /**
   * Cold observable over Server-Sent Events.
   * Unsubscribing closes the EventSource, which aborts the request,
   * and the server then cancels all in-flight supplier calls.
   */
  stream(p: SearchParams): Observable<StreamEvent> {
    const qs = new URLSearchParams({
      fromLocation: p.fromLocation,
      toLocation: p.toLocation,
      fromDate: p.fromDate,
      toDate: p.toDate,
    });
    p.suppliers.forEach(s => qs.append('suppliers', s));

    return new Observable<StreamEvent>(subscriber => {
      const es = new EventSource(`${API_BASE}/search?${qs}`);
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        es.close();
      };

      (['started', 'result', 'ended'] as const).forEach(type =>
        es.addEventListener(type, (event: Event) => {
          if (settled) return;
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
        finish();
        subscriber.error(new Error('Connection to the server was lost'));
      };

      return () => finish();
    });
  }
}
