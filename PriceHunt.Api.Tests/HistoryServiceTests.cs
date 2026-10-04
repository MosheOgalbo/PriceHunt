using PriceHunt.Api.Contracts;
using PriceHunt.Api.Domain;
using PriceHunt.Api.Services;

namespace PriceHunt.Api.Tests;

public sealed class HistoryServiceTests : IDisposable
{
    private readonly TestDbFactory _db = new();
    private readonly HistoryService _svc;
    private static readonly DateTime Day1 = new(2026, 10, 1, 23, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Day2 = new(2026, 10, 2, 9, 0, 0, DateTimeKind.Utc);

    public HistoryServiceTests()
    {
        _svc = new HistoryService(_db);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private void Seed()
    {
        using var db = _db.CreateDbContext();
        db.Searches.Add(NewSearch("Haifa", "Rotterdam", Day1, ("A", 50), ("B", 80)));
        db.Searches.Add(NewSearch("Tel Aviv", "Hamburg", Day2, ("A", 30), ("C", 120)));
        db.SaveChanges();
    }

    private static SearchRecord NewSearch(string from, string to, DateTime at, params (string Supplier, double Price)[] rs)
    {
        var s = new SearchRecord
        {
            Id = Guid.NewGuid(),
            FromLocation = from,
            ToLocation = to,
            FromDate = new(2026, 10, 10),
            ToDate = new(2026, 10, 12),
            Suppliers = string.Join(',', rs.Select(r => r.Supplier)),
            StartedAtUtc = at,
            FinishedAtUtc = at,
            Status = SearchStatus.Completed,
        };
        foreach (var (supplier, price) in rs)
            s.Responses.Add(new SupplierResponseRecord
            {
                Supplier = supplier,
                Price = price,
                ResponseTimeMs = 1000,
                TimestampUtc = at,
                Succeeded = true,
            });
        return s;
    }

    private static HistoryQuery Query(
        DateOnly? start = null, DateOnly? end = null, string[]? suppliers = null,
        string? from = null, string? sortBy = null, string? sortDir = null, int? page = null, int? size = null) =>
        new(start, end, suppliers, from, null, sortBy, sortDir, page, size);

    [Fact]
    public async Task Filters_by_supplier_list()
    {
        var result = await _svc.QueryAsync(Query(suppliers: ["A", "C"]), default);

        Assert.Equal(3, result.Total);
        Assert.DoesNotContain(result.Items, i => i.Supplier == "B");
    }

    [Fact]
    public async Task Date_range_includes_the_whole_end_day()
    {
        var result = await _svc.QueryAsync(Query(end: new DateOnly(2026, 10, 1)), default);

        Assert.Equal(2, result.Total);
        Assert.All(result.Items, i => Assert.Equal("Haifa", i.FromLocation));
    }

    [Fact]
    public async Task Filters_by_route_location()
    {
        var result = await _svc.QueryAsync(Query(from: "tel"), default);

        Assert.Equal(2, result.Total);
        Assert.All(result.Items, i => Assert.Equal("Hamburg", i.ToLocation));
    }

    [Fact]
    public async Task Sorts_by_price_ascending_and_pages()
    {
        var page1 = await _svc.QueryAsync(Query(sortBy: "price", sortDir: "asc", page: 1, size: 3), default);
        var page2 = await _svc.QueryAsync(Query(sortBy: "price", sortDir: "asc", page: 2, size: 3), default);

        Assert.Equal(4, page1.Total);
        Assert.Equal(new double?[] { 30, 50, 80 }, page1.Items.Select(i => i.Price));
        Assert.Equal(new double?[] { 120 }, page2.Items.Select(i => i.Price));
    }
}
