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

The UI is at http://localhost:4200. It opens in English. The language control in the toolbar opens a list (English, עברית, Русский, العربية) and remembers the choice. Hebrew and Arabic use right-to-left layout.

Location fields complete from a built-in list of real ports and cities (UN/LOCODE, place, and country). The value saved on a search is the English place name, so history stays the same in every language.

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
- Closing the `EventSource` from a new search or from Cancel calls `POST /api/search/cancel`, which stops supplier work immediately. A network drop is different: the browser reconnects with `Last-Event-ID` and the server replays events it already produced.

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
- If the client cancels or the disconnect grace expires, in-flight supplier calls are cancelled and the search is marked `Cancelled`. An `ended` event is still recorded so a client that reconnects can settle instead of hanging.

Client:

- A generation counter drops any event that belongs to a previous search, so a late result cannot appear in a new search.
- The result list is sorted cheapest-first. Failed suppliers sink below priced quotes, and a supplier that never answered sinks below those.
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

## Database (EF Core + SQLite, migrations)

On startup the API runs `Database.Migrate()`, so the schema is created or updated on first run. No database install and no manual migration command is required.

`Searches`

- `Id` (PK)
- `FromLocation`, `ToLocation`
- `FromDate`, `ToDate`
- `StartedAtUtc`, `FinishedAtUtc`
- `Status`: `Running`, `Completed`, `TimedOut`, `Cancelled`

`SearchSuppliers`

- `SearchId` + `Supplier` (composite PK, cascade delete)
- One row for each supplier that was queried

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

The history endpoint returns supplier responses, filtered by start date, end date (the end day is inclusive), one or more suppliers, and from/to location. The browser sends its timezone offset, so those calendar days are the user's local days rather than UTC midnights. Results can be sorted by date, route, supplier, price, or response time, and they are paged. A location filter treats `%` and `_` as literal characters.

A supplier that is still silent when the 6 second limit is reached is stored as a response with no price and the error "No response before the search ended". The search status stays `TimedOut`. Sorting by price puts those rows after every priced quote, in both directions.

`GET /health` checks that SQLite is reachable.

## Supplier calls

Each selected supplier runs on its own task.

- An attempt is limited to 5.5 seconds, inside the 6 second search. A normal quote (0.5–5 seconds) still fits.
- A thrown failure is retried once when the search window is still open. The supplier itself still fails about 30% of the time per attempt.
- Four failures in a row open a circuit for 20 seconds. Later searches skip that supplier immediately and record why. A timeout does not count as a failure, so GlobalPort still waits out the search instead of being skipped.
- Cancellation of the search, or of one attempt because the search ended, is not retried and does not open the circuit.

## Resuming a dropped stream

Every SSE event has an `id`. The Angular client sends a `streamId` with the search.

- Starting a new search, or pressing Cancel, calls `POST /api/search/cancel`. Supplier work stops immediately.
- If the connection drops without that call, the server keeps the search for one second. `EventSource` reconnects and sends `Last-Event-ID`, and the server replays the missed events. If nobody reconnects, the search is cancelled.

## Trade-offs

- Selected suppliers are a join table (`SearchSuppliers`), so a search can be queried by the suppliers that were asked without parsing text.
- `Price` is a `double` because EF Core on SQLite cannot `ORDER BY` a decimal. Missing prices sort after real prices.
- Migrations are applied automatically on startup, so a clone still runs with one command and the schema can change later.
- The search timeout is injectable so tests do not wait 6 seconds. The running API keeps the 6 second default. The DI registration is a factory because the container would otherwise try to resolve that optional `TimeSpan`.
- A dropped SSE connection waits one second before cancellation. That is long enough for `Last-Event-ID` to resume, and short enough that leaving the page still stops the work.
- One retry lowers how often FlexiShip's 30% failure is visible, because a second attempt can succeed. The failure rate on each attempt is unchanged.
- Tests use xUnit and SQLite in-memory, with one open connection so every context sees the same database. The Angular tests cover the rule that a late event from search N cannot enter search N+1.
- A search stays `Running` only if the process is killed mid-flight. Disconnects and timeouts update the status before the request ends.
- If a supplier already failed and the 6 second window closes during the retry, that failure is stored. It is not replaced with "No response".
- The circuit breaker is one instance for the process, so a run of failures can skip that supplier on a later search. A timeout does not count toward opening it.
- If the browser receives no SSE event for 10 seconds, the live search stops with a connection error instead of staying on "Searching…".

## What I would do differently

- Authentication, and a per-user history.
- A durable outbox for SSE events, so a resume still works after the API process restarts. The current buffer is in memory.
- Real supplier adapters behind the same `ISupplier` interface, with secrets outside the repo.

## AI usage

- The assignment was read from the PriceHunt PDF.
- The architecture (SSE, channel, single DB consumer, Angular Material screens, and the xUnit tests) was drafted in a Claude conversation and then implemented in this repository.
- Cursor (Grok) wrote the projects, fixed the SSE handler so it does not try to write a result after the response has started, closed `EventSource` when the stream ends, wired dependency injection so the optional test timeout does not break startup, and verified the API, tests, and UI.
