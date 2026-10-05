using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using PriceHunt.Api.Contracts;
using PriceHunt.Api.Data;
using PriceHunt.Api.Domain;

namespace PriceHunt.Api.Services;

public sealed class HistoryService(IDbContextFactory<PriceHuntDbContext> dbFactory)
{
    public async Task<PagedResult<HistoryItem>> QueryAsync(HistoryQuery q, CancellationToken ct)
    {
        await using var db = await dbFactory.CreateDbContextAsync(ct);
        IQueryable<SupplierResponseRecord> query = db.Responses.AsNoTracking();

        if (q.StartDate is { } start)
        {
            var from = start.ToDateTime(TimeOnly.MinValue);
            query = query.Where(r => r.TimestampUtc >= from);
        }
        if (q.EndDate is { } end)
        {
            var to = end.AddDays(1).ToDateTime(TimeOnly.MinValue);
            query = query.Where(r => r.TimestampUtc < to);
        }
        if (q.Suppliers is { Length: > 0 } sup)
            query = query.Where(r => sup.Contains(r.Supplier));
        if (!string.IsNullOrWhiteSpace(q.FromLocation))
        {
            var p = $"%{q.FromLocation.Trim()}%";
            query = query.Where(r => EF.Functions.Like(r.Search.FromLocation, p));
        }
        if (!string.IsNullOrWhiteSpace(q.ToLocation))
        {
            var p = $"%{q.ToLocation.Trim()}%";
            query = query.Where(r => EF.Functions.Like(r.Search.ToLocation, p));
        }

        var page = Math.Max(1, q.Page ?? 1);
        var size = Math.Clamp(q.PageSize ?? 10, 1, 100);
        var desc = !string.Equals(q.SortDir, "asc", StringComparison.OrdinalIgnoreCase);

        var total = await query.CountAsync(ct);
        var items = await Order(query, q.SortBy, desc)
            .ThenBy(r => r.Id)
            .Skip((page - 1) * size).Take(size)
            .Select(r => new HistoryItem(
                r.Id, r.TimestampUtc, r.Search.FromLocation, r.Search.ToLocation, r.Supplier,
                r.Price, r.ResponseTimeMs, r.Succeeded, r.Error, r.Search.Status.ToString()))
            .ToListAsync(ct);

        var result = items.Select(i => i with { TimestampUtc = DateTime.SpecifyKind(i.TimestampUtc, DateTimeKind.Utc) }).ToList();
        return new PagedResult<HistoryItem>(result, total, page, size);
    }

    private static IOrderedQueryable<SupplierResponseRecord> Order(
        IQueryable<SupplierResponseRecord> src, string? by, bool desc) => by?.ToLowerInvariant() switch
    {
        "route" => desc
            ? src.OrderByDescending(r => r.Search.FromLocation).ThenByDescending(r => r.Search.ToLocation)
            : src.OrderBy(r => r.Search.FromLocation).ThenBy(r => r.Search.ToLocation),
        "supplier" => By(src, r => r.Supplier, desc),
        "price" => desc
            ? src.OrderBy(r => r.Price == null).ThenByDescending(r => r.Price)
            : src.OrderBy(r => r.Price == null).ThenBy(r => r.Price),
        "responsetime" => By(src, r => r.ResponseTimeMs, desc),
        _ => By(src, r => r.TimestampUtc, desc),
    };

    private static IOrderedQueryable<T> By<T, TKey>(IQueryable<T> s, Expression<Func<T, TKey>> key, bool desc) =>
        desc ? s.OrderByDescending(key) : s.OrderBy(key);
}
