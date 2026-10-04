# PriceHunt

Live shipping-price search across seven simulated suppliers, with a persisted, filterable history.

Stack: .NET 8, ASP.NET Core, Entity Framework Core, SQLite, Angular 17, Angular Material.

## Run

From the repository root:

```bash
dotnet run --project PriceHunt.Api
```

The API listens on http://localhost:5080. On first run it creates `pricehunt.db` and the schema. No database install is required.

In a second terminal:

```bash
cd pricehunt-web && npm install && npm start
```

The UI is at http://localhost:4200.

Tests:

```bash
dotnet test PriceHunt.Api.Tests
```

## Streaming approach: Server-Sent Events

A search is one long-lived HTTP response (`text/event-stream`) with events `started`, `result`, and `ended`. Each supplier result is written as soon as that supplier finishes. The handler does not wait for the slowest supplier.

Why SSE:

- The data flow is one-directional, server to client.
- It is plain HTTP, so there is no extra dependency such as SignalR.
- Browsers already speak it through `EventSource`.
- Closing the `EventSource` aborts the request. ASP.NET Core surfaces that as `HttpContext.RequestAborted`, and that token is linked to every supplier call.

Alternatives considered:

- SignalR or WebSockets: bidirectional and heavier than this flow needs.
- Polling: extra latency and wasted requests.
- NDJSON over `fetch`: works, but the browser has to parse the stream by hand. `EventSource` already does that.

Server:

- Each selected supplier runs on its own task and writes into a `Channel<T>`.
- A single consumer persists the outcome and streams it, so a `DbContext` is never used from two threads.
- One linked `CancellationTokenSource` combines the client abort token with a 6 second timeout, and that token is passed into every supplier call.
- A supplier exception is caught inside that supplier's task, stored as a failed result, and does not cancel the others.
- When the time limit is reached, results already in the channel are flushed, the search is marked `TimedOut`, and an `ended` event is sent.
- If the client disconnects or starts a new search, in-flight supplier calls are cancelled and the search is marked `Cancelled`. No `ended` event is sent, because the client is already gone.

Client:

- A generation counter drops any event that belongs to a previous search, so a late result cannot appear in a new search.
- The result list is sorted cheapest-first. Failed suppliers sink to the bottom.
- Each row is absolutely positioned by its index and moves with a CSS transform, so reordering glides instead of jumping or flickering.
- The status line shows how many suppliers have responded, and a final badge: Completed, Timed out, or Cancelled.
- `EventSource` is closed when the stream ends, so the browser does not reconnect and flash a connection error after a successful search.

## Suppliers

All seven are in-process implementations of `ISupplier`. There are no outbound network calls.

| Supplier | Behavior |
| --- | --- |
| AeroFreight, BlueWave Shipping, CargoNova, DirectLine Express, EuroHaul | Random delay 0.5–5s, random price |
| FlexiShip | Same, and fails about 30% of the time |
| GlobalPort | Never responds. The search ends at the 6 second limit |

A search that includes GlobalPort therefore ends as Timed out. That is intended.

## Database (EF Core + SQLite, `EnsureCreated`)

`Searches`

- `Id` (PK)
- `FromLocation`, `ToLocation`
- `FromDate`, `ToDate`
- `Suppliers` (CSV of the names that were queried)
- `StartedAtUtc`, `FinishedAtUtc`
- `Status`: `Running`, `Completed`, `TimedOut`, `Cancelled`

`Responses`

- `Id` (PK)
- `SearchId` (FK, cascade delete)
- `Supplier`
- `Price` (nullable)
- `ResponseTimeMs`
- `TimestampUtc`
- `Succeeded`
- `Error`

Indexes: `Searches.StartedAtUtc`, `Responses.Supplier`, `Responses.TimestampUtc`.

The history endpoint returns supplier responses, filtered by start date, end date (the end day is inclusive), one or more suppliers, and from/to location. Results can be sorted by date, route, supplier, price, or response time, and they are paged.

A supplier that never answers is not a response, so it is not a history row. The search row still records that the search timed out.

## Trade-offs

- Selected suppliers are stored as CSV instead of a join table. It is simple to write and to show, and it is awkward to query.
- `Price` is a `double` because EF Core on SQLite cannot `ORDER BY` a decimal.
- `EnsureCreated` instead of migrations, so the project runs with no setup step. Schema changes in a real app would need migrations.
- The search timeout is injectable so tests do not wait 6 seconds. The running API keeps the 6 second default. The DI registration is a factory because the container would otherwise try to resolve that optional `TimeSpan`.
- Tests use xUnit and SQLite in-memory, with one open connection so every context sees the same database.
- A search left in `Running` only if the process is killed mid-flight. Disconnects and timeouts update the status before the request ends.

## What I would do differently

- EF migrations, and a join table for selected suppliers.
- Authentication, and a per-user history.
- An Angular component test that a late event from search N cannot enter search N+1.
- Per-supplier timeout, retry, and a circuit breaker, with the silent supplier reported explicitly instead of only through the search status.
- `Last-Event-ID` so a dropped SSE connection can resume.
- Structured logging and a health endpoint.

## AI usage

- The assignment was read from the PriceHunt PDF.
- The architecture (SSE, channel, single DB consumer, Angular Material screens, and the xUnit tests) was drafted in a Claude conversation and then implemented in this repository.
- Cursor (Grok) wrote the projects, fixed the SSE handler so it does not try to write a result after the response has started, closed `EventSource` when the stream ends, wired dependency injection so the optional test timeout does not break startup, and verified the API, tests, and UI.
