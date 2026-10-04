import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api.config';
import { HistoryFilter, HistoryItem, PagedResult } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  suppliers(): Observable<string[]> {
    return this.http.get<string[]>(`${API_BASE}/suppliers`);
  }

  history(f: HistoryFilter): Observable<PagedResult<HistoryItem>> {
    let params = new HttpParams()
      .set('sortBy', f.sortBy)
      .set('sortDir', f.sortDir)
      .set('page', f.page)
      .set('pageSize', f.pageSize);
    if (f.startDate) params = params.set('startDate', f.startDate);
    if (f.endDate) params = params.set('endDate', f.endDate);
    if (f.fromLocation) params = params.set('fromLocation', f.fromLocation);
    if (f.toLocation) params = params.set('toLocation', f.toLocation);
    f.suppliers.forEach(s => (params = params.append('suppliers', s)));
    return this.http.get<PagedResult<HistoryItem>>(`${API_BASE}/history`, { params });
  }
}
