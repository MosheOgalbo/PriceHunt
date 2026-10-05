using System.Diagnostics;
using System.Text.Json;
using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PriceHunt.Api.Contracts;
using PriceHunt.Api.Data;
using PriceHunt.Api.Domain;
using PriceHunt.Api.Suppliers;

namespace PriceHunt.Api.Services;

public sealed class SearchService
{
    public const string NoResponseError = "No response before the search ended";
    public const string CircuitOpenError = "Supplier is temporarily skipped after repeated failures";

    public static readonly TimeSpan DefaultMaxDuration = TimeSpan.FromSeconds(6);

    private readonly IDbContextFactory<PriceHuntDbContext> _dbFactory;
    private readonly IReadOnlyList<ISupplier> _all;
    private readonly TimeSpan _maxDuration;
    private readonly ILogger<SearchService>? _logger;
    private readonly SupplierExecutionOptions _execution;
    private readonly SupplierCircuitBreaker _circuits;

    public SearchService(
        IDbContextFactory<PriceHuntDbContext> dbFactory,
        IEnumerable<ISupplier> suppliers,
        TimeSpan? maxDuration = null,
        ILogger<SearchService>? logger = null,
        SupplierExecutionOptions? execution = null,
        SupplierCircuitBreaker? circuits = null)
    {
        _dbFactory = dbFactory;
        _all = suppliers.ToList();
        _maxDuration = maxDuration ?? DefaultMaxDuration;
        _logger = logger;
        _execution = execution ?? SupplierExecutionOptions.Default;
        _circuits = circuits ?? new SupplierCircuitBreaker(_execution);
    }

    private sealed record Outcome(string Supplier, decimal? Price, int ResponseTimeMs, DateTime TimestampUtc, string? Error);

    public IReadOnlyList<string> SupplierNames => _all.Select(s => s.Name).ToList();

    public IReadOnlyList<ISupplier> Resolve(string[]? names) =>
        names is { Length: > 0 }
            ? _all.Where(s => names.Contains(s.Name, StringComparer.OrdinalIgnoreCase)).ToList()
            : _all;

    public async IAsyncEnumerable<StreamEvent> SearchAsync(
        SearchCriteria criteria, IReadOnlyList<ISupplier> selected,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        await using var db = await _dbFactory.CreateDbContextAsync(CancellationToken.None);
        var search = new SearchRecord
        {
            Id = Guid.NewGuid(),
            FromLocation = criteria.FromLocation,
            ToLocation = criteria.ToLocation,
            FromDate = criteria.FromDate,
            ToDate = criteria.ToDate,
            StartedAtUtc = DateTime.UtcNow,
            Status = SearchStatus.Running,
            SelectedSuppliers = selected.Select(s => new SearchSupplier { Supplier = s.Name }).ToList(),
        };
        db.Searches.Add(search);
        await db.SaveChangesAsync(CancellationToken.None);
        _logger?.LogInformation(
            "Search {SearchId} started from {FromLocation} to {ToLocation} across {SupplierCount} suppliers",
            search.Id, criteria.FromLocation, criteria.ToLocation, selected.Count);

        using var timeoutCts = new CancellationTokenSource(_maxDuration);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);

        var channel = Channel.CreateUnbounded<Outcome>(new UnboundedChannelOptions { SingleReader = true });
        var workers = selected.Select(s => QuerySupplierAsync(s, criteria, channel.Writer, linked.Token)).ToArray();
        _ = Task.WhenAll(workers).ContinueWith(
            _ => channel.Writer.TryComplete(), TaskScheduler.Default);

        var reader = channel.Reader;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var realAnswers = 0;

        try
        {
            yield return new StreamEvent("started",
                new StartedPayload(search.Id, selected.Count, (int)Math.Ceiling(_maxDuration.TotalSeconds)));

            while (true)
            {
                bool hasData;
                try
                {
                    hasData = await reader.WaitToReadAsync(linked.Token);
                }
                catch (OperationCanceledException)
                {
                    break;
                }

                if (!hasData) break;

                while (reader.TryRead(out var outcome))
                    yield return await PersistAsync(outcome);
            }

            // Workers may still be writing the real error after the window closes.
            try
            {
                await Task.WhenAll(workers).WaitAsync(TimeSpan.FromSeconds(2));
            }
            catch (TimeoutException)
            {
                _logger?.LogWarning("Search {SearchId} stopped waiting for supplier tasks", search.Id);
            }

            while (reader.TryRead(out var late))
                yield return await PersistAsync(late);

            var clientCancelled = ct.IsCancellationRequested && !timeoutCts.IsCancellationRequested;
            var missing = selected.Where(s => !seen.Contains(s.Name)).Select(s => s.Name).ToList();
            var incomplete = missing.Count > 0;

            if (!clientCancelled && incomplete)
            {
                var elapsed = (int)Math.Min(int.MaxValue, _maxDuration.TotalMilliseconds);
                foreach (var name in missing)
                    yield return await PersistAsync(new Outcome(name, null, elapsed, DateTime.UtcNow, NoResponseError));
            }

            search.Status = clientCancelled
                ? SearchStatus.Cancelled
                : incomplete ? SearchStatus.TimedOut : SearchStatus.Completed;
            search.FinishedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None);
            _logger?.LogInformation(
                "Search {SearchId} finished with status {Status}. {Answered} of {SupplierCount} suppliers answered",
                search.Id, search.Status, realAnswers, selected.Count);

            yield return new StreamEvent("ended", new EndedPayload(
                search.Id,
                JsonNamingPolicy.CamelCase.ConvertName(search.Status.ToString()),
                realAnswers,
                selected.Count));
        }
        finally
        {
            linked.Cancel();
            if (search.Status == SearchStatus.Running)
            {
                search.Status = SearchStatus.Cancelled;
                search.FinishedAtUtc = DateTime.UtcNow;
                await db.SaveChangesAsync(CancellationToken.None);
                _logger?.LogWarning("Search {SearchId} was cancelled before it could finish cleanly", search.Id);
            }
        }

        async Task<StreamEvent> PersistAsync(Outcome outcome)
        {
            seen.Add(outcome.Supplier);
            var noResponse = outcome.Error == NoResponseError;
            if (!noResponse) realAnswers++;

            db.Responses.Add(new SupplierResponseRecord
            {
                SearchId = search.Id,
                Supplier = outcome.Supplier,
                Price = outcome.Price is null ? null : (double)outcome.Price,
                ResponseTimeMs = outcome.ResponseTimeMs,
                TimestampUtc = outcome.TimestampUtc,
                Succeeded = outcome.Error is null,
                Error = outcome.Error,
            });
            await db.SaveChangesAsync(CancellationToken.None);

            var kind = outcome.Error is null ? "ok" : noResponse ? "noResponse" : "failed";
            _logger?.LogInformation(
                "Search {SearchId} supplier {Supplier} outcome {Outcome} in {ResponseTimeMs} ms",
                search.Id, outcome.Supplier, kind, outcome.ResponseTimeMs);

            return new StreamEvent("result", new ResultPayload(
                search.Id, outcome.Supplier, outcome.Price, outcome.ResponseTimeMs,
                outcome.Error is null, outcome.Error, outcome.TimestampUtc, kind));
        }
    }

    private async Task QuerySupplierAsync(
        ISupplier supplier, SearchCriteria criteria, ChannelWriter<Outcome> writer, CancellationToken ct)
    {
        if (!_circuits.Allow(supplier.Name))
        {
            _logger?.LogWarning("Supplier {Supplier} skipped because its circuit is open", supplier.Name);
            writer.TryWrite(new Outcome(supplier.Name, null, 0, DateTime.UtcNow, CircuitOpenError));
            return;
        }

        var sw = Stopwatch.StartNew();
        Exception? last = null;
        for (var attempt = 1; attempt <= _execution.MaxAttempts; attempt++)
        {
            if (ct.IsCancellationRequested)
            {
                WriteInterrupted();
                return;
            }

            using var attemptCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            attemptCts.CancelAfter(_execution.AttemptTimeout);
            try
            {
                var price = await supplier.GetPriceAsync(criteria, attemptCts.Token);
                _circuits.RecordSuccess(supplier.Name);
                writer.TryWrite(new Outcome(supplier.Name, price, (int)sw.ElapsedMilliseconds, DateTime.UtcNow, null));
                return;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                WriteInterrupted();
                return;
            }
            catch (OperationCanceledException)
            {
                last = new TimeoutException($"{supplier.Name} did not respond in time");
            }
            catch (Exception ex)
            {
                last = ex;
            }

            var retry = attempt < _execution.MaxAttempts && !ct.IsCancellationRequested;
            if (!retry)
            {
                if (last is not TimeoutException)
                    _circuits.RecordFailure(supplier.Name);
                writer.TryWrite(new Outcome(
                    supplier.Name, null, (int)sw.ElapsedMilliseconds, DateTime.UtcNow, last?.Message ?? "Supplier failed"));
                return;
            }

            _logger?.LogInformation(
                "Retrying supplier {Supplier} after attempt {Attempt} failed: {Reason}",
                supplier.Name, attempt, last?.Message);
        }

        // A real failure must not be rewritten as "no response" when the search window closes mid-retry.
        void WriteInterrupted()
        {
            if (last is not null and not TimeoutException)
                writer.TryWrite(new Outcome(supplier.Name, null, (int)sw.ElapsedMilliseconds, DateTime.UtcNow, last.Message));
        }
    }
}
