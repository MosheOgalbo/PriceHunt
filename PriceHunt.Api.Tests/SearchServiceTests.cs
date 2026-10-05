using Microsoft.EntityFrameworkCore;
using PriceHunt.Api.Contracts;
using PriceHunt.Api.Domain;
using PriceHunt.Api.Services;
using PriceHunt.Api.Suppliers;

namespace PriceHunt.Api.Tests;

public sealed class SearchServiceTests : IDisposable
{
    private static readonly SearchCriteria Criteria = new("Haifa", "Rotterdam", new(2026, 10, 1), new(2026, 10, 5));
    private readonly TestDbFactory _db = new();

    public void Dispose() => _db.Dispose();

    private SearchService Create(
        ISupplier[] suppliers,
        int maxMs = 3000,
        SupplierExecutionOptions? execution = null) =>
        new(_db, suppliers, TimeSpan.FromMilliseconds(maxMs), execution: execution);

    private static async Task<List<StreamEvent>> Run(SearchService svc, ISupplier[] suppliers, CancellationToken ct = default)
    {
        var events = new List<StreamEvent>();
        await foreach (var ev in svc.SearchAsync(Criteria, suppliers, ct)) events.Add(ev);
        return events;
    }

    private SearchRecord LoadSearch()
    {
        using var db = _db.CreateDbContext();
        return db.Searches.Include(s => s.Responses).Include(s => s.SelectedSuppliers).Single();
    }

    [Fact]
    public async Task Streams_results_in_arrival_order_then_completes()
    {
        ISupplier[] suppliers =
        [
            new FakeSupplier("Slow", 300, 30m),
            new FakeSupplier("Fast", 50, 90m),
            new FakeSupplier("Mid", 150, 60m),
        ];

        var events = await Run(Create(suppliers), suppliers);

        Assert.Equal(["started", "result", "result", "result", "ended"], events.Select(e => e.Type));
        Assert.Equal(
            ["Fast", "Mid", "Slow"],
            events.Where(e => e.Type == "result").Select(e => ((ResultPayload)e.Data).Supplier));

        var ended = Assert.IsType<EndedPayload>(events[^1].Data);
        Assert.Equal("completed", ended.Status);
        Assert.Equal(3, ended.Responded);

        var saved = LoadSearch();
        Assert.Equal(SearchStatus.Completed, saved.Status);
        Assert.Equal(3, saved.Responses.Count);
        Assert.Equal(3, saved.SelectedSuppliers.Count);
        Assert.NotNull(saved.FinishedAtUtc);
    }

    [Fact]
    public async Task Supplier_failure_is_recorded_and_does_not_affect_others()
    {
        ISupplier[] suppliers = [new FakeSupplier("Ok", 50, 70m), new FakeSupplier("Bad", 80, fail: true)];

        var events = await Run(Create(suppliers), suppliers);

        var results = events.Where(e => e.Type == "result").Select(e => (ResultPayload)e.Data).ToList();
        Assert.Equal(2, results.Count);
        Assert.True(results.Single(r => r.Supplier == "Ok").Succeeded);
        Assert.False(results.Single(r => r.Supplier == "Bad").Succeeded);

        var saved = LoadSearch();
        Assert.Equal(SearchStatus.Completed, saved.Status);
        var failed = saved.Responses.Single(r => r.Supplier == "Bad");
        Assert.False(failed.Succeeded);
        Assert.Null(failed.Price);
        Assert.Equal("boom", failed.Error);
    }

    [Fact]
    public async Task Search_times_out_with_partial_results_and_cancels_pending_suppliers()
    {
        var never = new FakeSupplier("Never", null);
        ISupplier[] suppliers = [new FakeSupplier("Fast", 50, 80m), never];

        var events = await Run(Create(suppliers, maxMs: 400), suppliers);

        var results = events.Where(e => e.Type == "result").Select(e => (ResultPayload)e.Data).ToList();
        Assert.Equal(2, results.Count);
        Assert.True(results.Single(r => r.Supplier == "Fast").Succeeded);
        var silent = results.Single(r => r.Supplier == "Never");
        Assert.Equal("noResponse", silent.Outcome);
        Assert.Equal(SearchService.NoResponseError, silent.Error);

        var ended = Assert.IsType<EndedPayload>(events[^1].Data);
        Assert.Equal("timedOut", ended.Status);
        Assert.Equal(1, ended.Responded);
        Assert.Equal(2, ended.Total);

        var saved = LoadSearch();
        Assert.Equal(SearchStatus.TimedOut, saved.Status);
        Assert.Contains(saved.Responses, r => r.Supplier == "Never" && r.Succeeded == false);
        await never.Cancelled.WaitAsync(TimeSpan.FromSeconds(2));
    }

    [Fact]
    public async Task Client_cancellation_stops_supplier_work_and_marks_search_cancelled()
    {
        var slow = new FakeSupplier("Slow", 5000);
        ISupplier[] suppliers = [new FakeSupplier("Fast", 50, 80m), slow];
        var svc = Create(suppliers, maxMs: 10_000);

        using var cts = new CancellationTokenSource();
        var events = new List<StreamEvent>();
        await foreach (var ev in svc.SearchAsync(Criteria, suppliers, cts.Token))
        {
            events.Add(ev);
            if (ev.Type == "result") cts.Cancel();
        }

        var ended = Assert.IsType<EndedPayload>(Assert.Single(events, e => e.Type == "ended").Data);
        Assert.Equal("cancelled", ended.Status);
        Assert.Equal(SearchStatus.Cancelled, LoadSearch().Status);
        await slow.Cancelled.WaitAsync(TimeSpan.FromSeconds(2));
    }

    [Fact]
    public async Task Default_execution_does_not_retry_failed_suppliers()
    {
        var flaky = new FakeSupplier("Flaky", 20, 40m, failTimes: 1);
        ISupplier[] suppliers = [flaky];

        var events = await Run(Create(suppliers), suppliers);

        var result = Assert.IsType<ResultPayload>(Assert.Single(events, e => e.Type == "result").Data);
        Assert.False(result.Succeeded);
        Assert.Equal("boom", result.Error);
        Assert.Equal(1, flaky.Calls);
    }

    [Fact]
    public async Task Failed_supplier_is_retried_once_and_can_recover_when_retry_enabled()
    {
        var flaky = new FakeSupplier("Flaky", 20, 40m, failTimes: 1);
        ISupplier[] suppliers = [flaky];
        var options = new SupplierExecutionOptions { MaxAttempts = 2 };

        var events = await Run(Create(suppliers, execution: options), suppliers);

        var result = Assert.IsType<ResultPayload>(Assert.Single(events, e => e.Type == "result").Data);
        Assert.True(result.Succeeded);
        Assert.Equal(40m, result.Price);
        Assert.Equal(2, flaky.Calls);
    }

    [Fact]
    public async Task Cancellation_during_retry_keeps_the_real_supplier_error()
    {
        var flaky = new FailThenHang();
        var options = new SupplierExecutionOptions { MaxAttempts = 2 };
        var events = await Run(Create([flaky], maxMs: 400, execution: options), [flaky]);

        var result = Assert.IsType<ResultPayload>(Assert.Single(events, e => e.Type == "result").Data);
        Assert.Equal("failed", result.Outcome);
        Assert.Equal("boom", result.Error);
        Assert.Equal("boom", LoadSearch().Responses.Single().Error);
    }

    [Fact]
    public async Task Attempt_timeout_does_not_open_the_circuit()
    {
        var hang = new FakeSupplier("Slow", null);
        var options = new SupplierExecutionOptions
        {
            MaxAttempts = 1,
            AttemptTimeout = TimeSpan.FromMilliseconds(40),
            FailureThreshold = 1,
            BreakDuration = TimeSpan.FromMinutes(1),
        };
        var svc = new SearchService(
            _db, [hang], TimeSpan.FromSeconds(2), execution: options, circuits: new SupplierCircuitBreaker(options));

        await Run(svc, [hang]);
        var again = await Run(svc, [hang]);

        var second = Assert.IsType<ResultPayload>(Assert.Single(again, e => e.Type == "result").Data);
        Assert.NotEqual(SearchService.CircuitOpenError, second.Error);
        Assert.Equal(2, hang.Calls);
    }

    [Fact]
    public async Task Open_circuit_skips_the_supplier_without_calling_it_again()
    {
        var bad = new FakeSupplier("Bad", 10, fail: true);
        var options = new SupplierExecutionOptions
        {
            MaxAttempts = 2,
            AttemptTimeout = TimeSpan.FromSeconds(2),
            FailureThreshold = 1,
            BreakDuration = TimeSpan.FromMinutes(1),
        };
        var svc = new SearchService(
            _db, [bad], TimeSpan.FromSeconds(3), execution: options, circuits: new SupplierCircuitBreaker(options));

        await Run(svc, [bad]);
        Assert.Equal(2, bad.Calls);

        var again = await Run(svc, [bad]);
        var skipped = Assert.IsType<ResultPayload>(Assert.Single(again, e => e.Type == "result").Data);
        Assert.Equal(SearchService.CircuitOpenError, skipped.Error);
        Assert.Equal("failed", skipped.Outcome);
        Assert.Equal(2, bad.Calls);
    }

    /// <summary>First call fails immediately. The retry waits until the search window cancels it.</summary>
    private sealed class FailThenHang : ISupplier
    {
        private int _calls;
        public string Name => "Flaky";

        public async Task<decimal> GetPriceAsync(SearchCriteria criteria, CancellationToken ct)
        {
            if (Interlocked.Increment(ref _calls) == 1)
                throw new InvalidOperationException("boom");
            await Task.Delay(Timeout.Infinite, ct);
            return 0;
        }
    }
}
