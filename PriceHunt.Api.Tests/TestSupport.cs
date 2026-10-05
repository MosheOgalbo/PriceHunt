using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PriceHunt.Api.Data;
using PriceHunt.Api.Suppliers;

namespace PriceHunt.Api.Tests;

/// <summary>SQLite in-memory DB shared across contexts through one open connection.</summary>
public sealed class TestDbFactory : IDbContextFactory<PriceHuntDbContext>, IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    public TestDbFactory()
    {
        _connection.Open();
        using var db = CreateDbContext();
        db.Database.EnsureCreated();
    }

    public PriceHuntDbContext CreateDbContext() =>
        new(new DbContextOptionsBuilder<PriceHuntDbContext>().UseSqlite(_connection).Options);

    public void Dispose() => _connection.Dispose();
}

/// <summary>Deterministic supplier. delayMs = null means it never responds.</summary>
public sealed class FakeSupplier(string name, int? delayMs, decimal price = 100m, bool fail = false, int failTimes = 0) : ISupplier
{
    private readonly TaskCompletionSource _cancelled = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private int _calls;

    public string Name => name;

    /// <summary>Completes when the supplier call observed cancellation.</summary>
    public Task Cancelled => _cancelled.Task;

    public int Calls => _calls;

    public async Task<decimal> GetPriceAsync(SearchCriteria criteria, CancellationToken ct)
    {
        var call = Interlocked.Increment(ref _calls);
        try
        {
            await Task.Delay(delayMs ?? Timeout.Infinite, ct);
        }
        catch (OperationCanceledException)
        {
            _cancelled.TrySetResult();
            throw;
        }

        if (fail || call <= failTimes) throw new InvalidOperationException("boom");
        return price;
    }
}
