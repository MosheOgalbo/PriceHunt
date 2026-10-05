import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Observable, of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { StreamEvent, SupplierResult } from '../../core/models';
import { SearchStreamService } from '../../core/search-stream.service';
import { SearchComponent } from './search.component';

describe('SearchComponent', () => {
  let fixture: ComponentFixture<SearchComponent>;
  let listeners: Array<(event: StreamEvent) => void>;

  beforeEach(async () => {
    listeners = [];
    await TestBed.configureTestingModule({
      imports: [SearchComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        { provide: ApiService, useValue: { suppliers: () => of(['AeroFreight', 'GlobalPort']) } },
        {
          provide: SearchStreamService,
          useValue: {
            stream: () => new Observable<StreamEvent>(subscriber => {
              listeners.push(event => subscriber.next(event));
              return () => undefined;
            }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchComponent);
    fixture.detectChanges();
  });

  it('keeps a searching slot for each supplier until that supplier answers', () => {
    const component = fixture.componentInstance;
    component.form.setValue({
      fromLocation: 'Haifa',
      toLocation: 'Rotterdam',
      fromDate: new Date(2026, 9, 10),
      toDate: new Date(2026, 9, 20),
      suppliers: ['AeroFreight', 'GlobalPort'],
    });

    component.search();

    expect(component.slots().map(slot => slot.supplier)).toEqual(['AeroFreight', 'GlobalPort']);
    expect(component.slots().every(slot => slot.result === null)).toBeTrue();
    expect(component.travel()).toBe(0);

    listeners[0](resultEvent('GlobalPort', 90));

    expect(component.slots()[0].result?.supplier).toBe('GlobalPort');
    expect(component.slots()[1]).toEqual({ supplier: 'AeroFreight', result: null });
    expect(component.travel()).toBe(0.5);

    listeners[0](resultEvent('AeroFreight', 180));
    expect(component.travel()).toBe(1);
  });

  it('does not show a result that arrives for a search the user already replaced', () => {
    const component = fixture.componentInstance;
    component.form.setValue({
      fromLocation: 'Haifa',
      toLocation: 'Rotterdam',
      fromDate: new Date(2026, 9, 10),
      toDate: new Date(2026, 9, 20),
      suppliers: ['AeroFreight', 'GlobalPort'],
    });

    component.search();
    component.search();

    listeners[0](resultEvent('AeroFreight', 180));
    listeners[1](resultEvent('GlobalPort', 90));

    expect(component.results().map(r => r.supplier)).toEqual(['GlobalPort']);
  });
});

function resultEvent(supplier: string, price: number): StreamEvent {
  const data: SupplierResult = {
    searchId: 'search',
    supplier,
    price,
    responseTimeMs: 1000,
    succeeded: true,
    error: null,
    receivedAtUtc: '2026-10-05T00:00:00Z',
    outcome: 'ok',
  };
  return { type: 'result', data };
}
