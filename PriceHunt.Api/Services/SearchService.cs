using System.Diagnostics;
using System.Text.Json;
using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using PriceHunt.Api.Contracts;
using PriceHunt.Api.Data;
using PriceHunt.Api.Domain;
using PriceHunt.Api.Suppliers;

namespace PriceHunt.Api.Services;

public sealed class SearchService(
    IDbContextFactory<PriceHuntDbContext> dbFactory,
    IEnumerable<ISupplier> suppliers,
    TimeSpan? maxDuration = null)
{
    public static readonly TimeSpan DefaultMaxDuration = TimeSpan.FromSeconds(6);
    private readonly TimeSpan _maxDuration = maxDuration ?? DefaultMaxDuration;
    private readonly IReadOnlyList<ISupplier> _all = suppliers.ToList();

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
        await using var db = await dbFactory.CreateDbContextAsync(CancellationToken.None);
        var search = new SearchRecord
        {
            Id = Guid.NewGuid(),
            FromLocation = criteria.FromLocation,
            ToLocation = criteria.ToLocation,
            FromDate = criteria.FromDate,
            ToDate = criteria.ToDate,
            Suppliers = string.Join(',', selected.Select(s => s.Name)),
            StartedAtUtc = DateTime.UtcNow,
            Status = SearchStatus.Running,
        };
        db.Searches.Add(search);
        await db.SaveChangesAsync(CancellationToken.None);

        using var timeoutCts = new CancellationTokenSource(_maxDuration);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);

        var channel = Channel.CreateUnbounded<Outcome>(new UnboundedChannelOptions { SingleReader = true });
        var workers = selected.Select(s => QuerySupplierAsync(s, criteria, channel.Writer, linked.Token)).ToArray();
        _ = Task.WhenAll(workers).ContinueWith(_ => channel.Writer.TryComplete(), TaskScheduler.Default);

        var reader = channel.Reader;
        var finished = false;
        var responded = 0;

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
                    if (ct.IsCancellationRequested || !reader.TryPeek(out _)) break;
                    hasData = true;
                }

                if (!hasData)
                {
                    finished = true;
                    break;
                }

                while (reader.TryRead(out var o))
                {
                    responded++;
                    db.Responses.Add(new SupplierResponseRecord
                    {
                        SearchId = search.Id,
                        Supplier = o.Supplier,
                        Price = o.Price is null ? null : (double)o.Price,
                        ResponseTimeMs = o.ResponseTimeMs,
                        TimestampUtc = o.TimestampUtc,
                        Succeeded = o.Error is null,
                        Error = o.Error,
                    });
                    await db.SaveChangesAsync(CancellationToken.None);

                    yield return new StreamEvent("result", new ResultPayload(
                        search.Id, o.Supplier, o.Price, o.ResponseTimeMs, o.Error is null, o.Error, o.TimestampUtc));
                }
            }

            search.Status = finished
                ? SearchStatus.Completed
                : timeoutCts.IsCancellationRequested && !ct.IsCancellationRequested
                    ? SearchStatus.TimedOut
                    : SearchStatus.Cancelled;
            search.FinishedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None);

            if (search.Status == SearchStatus.Cancelled) yield break;

            yield return new StreamEvent("ended", new EndedPayload(
                search.Id,
                JsonNamingPolicy.CamelCase.ConvertName(search.Status.ToString()),
                responded,
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
            }
        }
    }

    private static async Task QuerySupplierAsync(
        ISupplier supplier, SearchCriteria criteria, ChannelWriter<Outcome> writer, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var price = await supplier.GetPriceAsync(criteria, ct);
            writer.TryWrite(new Outcome(supplier.Name, price, (int)sw.ElapsedMilliseconds, DateTime.UtcNow, null));
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            writer.TryWrite(new Outcome(supplier.Name, null, (int)sw.ElapsedMilliseconds, DateTime.UtcNow, ex.Message));
        }
    }
}
