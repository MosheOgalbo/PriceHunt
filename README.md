# PriceHunt

Live shipping-price search across seven simulated suppliers, with a persisted, filterable history.

The assignment asks for **.NET 8 or later** and **Angular 17 or later**. This repo uses those floors. Solution file: classic `PriceHunt.sln`.

## Stack

| Area | Technology |
| --- | --- |
| API | .NET 8, ASP.NET Core minimal APIs, EF Core 8 + SQLite, SSE (`text/event-stream`) + `Channel<T>` |
| Resilience | Per-supplier attempt timeout (5.5s inside a hard 6s search). Default `MaxAttempts = 1` (no retry). Optional retry via `MaxAttempts = 2` in tests |
| Money | Stored as integer **cents** (`PriceCents`); API/UI expose decimal dollars |
| Web | Angular 17, Material 17, RxJS, EN/HE/RU/AR (+ RTL), day/night theme |
| Tests | xUnit (API), Karma/Jasmine (web) |

No Docker, no paid cloud DB, no real outbound supplier HTTP — suppliers are in-process simulations.

**Decorative UI only:** waybill numbers, shipment IDs, supplier codes, license plates, and the tracking-map truck animation are simulated from the search seed. They are not persisted or returned by the API.

## Run

```bash
dotnet run --project PriceHunt.Api
```

API: http://localhost:5080. On first run it creates `pricehunt.db` and applies migrations.

```bash
cd pricehunt-web
npm install   # once (or after package changes)
npm start
```

UI: http://localhost:4200. Language and theme persist in `localStorage`.

```bash
dotnet test PriceHunt.Api.Tests
cd pricehunt-web && npx ng test --watch=false --browsers=ChromeHeadless
```

## Streaming (SSE)

One long-lived `text/event-stream` response with `started`, `result`, and `ended`. Each supplier writes as soon as it finishes.

**Server:** each supplier on its own task → `Channel<T>` → single consumer persists and streams (one `DbContext`). A linked CTS combines client abort + hard 6s deadline. After the window, the consumer drains workers for the **remaining** budget (or ~150ms if already spent) so real failures can flush, then records silent suppliers as “No response…” and emits `ended` (`completed` / `timedOut` / `cancelled`).

**Client:** generation counter drops late events from a previous search; results sort cheapest-first; `EventSource` closes on `ended`. Cancel / new search → `POST /api/search/cancel`. Dropped connections get a short resume window via `Last-Event-ID`.

## Suppliers

| Supplier | Behavior |
| --- | --- |
| AeroFreight, BlueWave Shipping, CargoNova, DirectLine Express, EuroHaul | Random delay 0.5–5s, random price |
| FlexiShip | Same, fails ~30% of the time (visible because retry is off by default) |
| GlobalPort | Never responds → search ends as Timed out |

## Database

`Database.Migrate()` on startup.

- **Searches** — route, dates, status (`Running` / `Completed` / `TimedOut` / `Cancelled`)
- **SearchSuppliers** — who was queried
- **Responses** — `PriceCents` (nullable long), timing, success/error

History filters (optional): local calendar days (browser tz offset), suppliers, from/to location (`%`/`_` literal), sort, paging. Missing prices sort last.

`GET /health` — SQLite reachable.

## Trade-offs (short)

- Hard 6s search deadline; no circuit breaker (timeouts must not skip GlobalPort).
- Cents in SQLite avoid float sort/storage issues; DTOs stay in dollars.
- Retry off by default so FlexiShip’s failure rate stays reviewable.
- In-memory SSE buffer — resume works across reconnects in the same process, not across API restarts.
- Live Search: today+ dates only. History: any past range.

## Manual verification

1. Start API + UI (`dotnet run` / `npm start`).
2. Live Search: pick route + dates (today or later), run search — results stream in; GlobalPort → Timed out + “No response”.
3. Cancel mid-search — status Cancelled; work stops.
4. History: filter by date / supplier / location; sort by price; page.
5. Theme + language (incl. RTL HE/AR); mobile layout for history cards.
6. `dotnet test` and `ng test` (headless) pass.

## What I would do differently

- Auth + per-user history.
- Durable outbox for SSE across process restarts.
- Real supplier adapters behind `ISupplier`.

## AI usage

Assignment allows AI. Used for requirements extraction from the PDF, architecture draft (SSE vs SignalR, channel + single DB consumer), and implementation/iteration in Cursor. Human review owns product decisions, stack floors (.NET 8 / Angular 17), and final verification.
