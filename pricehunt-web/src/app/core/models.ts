export interface SearchParams {
  fromLocation: string;
  toLocation: string;
  fromDate: string;
  toDate: string;
  suppliers: string[];
}

export interface StartedEvent {
  searchId: string;
  totalSuppliers: number;
  maxDurationSeconds: number;
}

export type QuoteOutcome = 'ok' | 'failed' | 'noResponse';

export interface SupplierResult {
  searchId: string;
  supplier: string;
  price: number | null;
  responseTimeMs: number;
  succeeded: boolean;
  error: string | null;
  receivedAtUtc: string;
  outcome: QuoteOutcome;
}

export type SearchOutcome = 'completed' | 'timedOut' | 'cancelled';
export interface EndedEvent {
  searchId: string;
  status: SearchOutcome;
  responded: number;
  total: number;
}

export type StreamEvent =
  | { type: 'started'; data: StartedEvent }
  | { type: 'result'; data: SupplierResult }
  | { type: 'ended'; data: EndedEvent };

export interface HistoryItem {
  id: number;
  timestampUtc: string;
  fromLocation: string;
  toLocation: string;
  supplier: string;
  price: number | null;
  responseTimeMs: number;
  succeeded: boolean;
  error: string | null;
  searchStatus: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface HistoryFilter {
  startDate?: string;
  endDate?: string;
  suppliers: string[];
  fromLocation?: string;
  toLocation?: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}
