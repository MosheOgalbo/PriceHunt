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

    private SearchService Create(ISupplier[] suppliers, int maxMs = 3000) =>
        new(_db, suppliers, TimeSpan.FromMilliseconds(maxMs));

    private static async Task<List<StreamEvent>> Run(SearchService svc, ISupplier[] suppliers, CancellationToken ct = default)
    {
        var events = new List<StreamEvent>();
        await foreach (var ev in svc.SearchAsync(Criteria, suppliers, ct)) events.Add(ev);
        return events;
    }

    private SearchRecord LoadSearch()
    {
        using var db = _db.CreateDbContext();
        return db.Searches.Include(s => s.Responses).Single();
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

        Assert.Single(events, e => e.Type == "result");
        var ended = Assert.IsType<EndedPayload>(events[^1].Data);
        Assert.Equal("timedOut", ended.Status);
        Assert.Equal(1, ended.Responded);

        Assert.Equal(SearchStatus.TimedOut, LoadSearch().Status);
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

        Assert.DoesNotContain(events, e => e.Type == "ended");
        Assert.Equal(SearchStatus.Cancelled, LoadSearch().Status);
        await slow.Cancelled.WaitAsync(TimeSpan.FromSeconds(2));
    }
}
