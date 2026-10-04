namespace PriceHunt.Api.Suppliers;

public sealed record SearchCriteria(string FromLocation, string ToLocation, DateOnly FromDate, DateOnly ToDate);

public interface ISupplier
{
    string Name { get; }
    Task<decimal> GetPriceAsync(SearchCriteria criteria, CancellationToken ct);
}

public enum SupplierBehavior { Normal, Flaky, NeverResponds }

public sealed class SimulatedSupplier(string name, SupplierBehavior behavior = SupplierBehavior.Normal) : ISupplier
{
    public string Name => name;

    public async Task<decimal> GetPriceAsync(SearchCriteria criteria, CancellationToken ct)
    {
        if (behavior == SupplierBehavior.NeverResponds)
        {
            await Task.Delay(Timeout.Infinite, ct);
            return 0;
        }

        await Task.Delay(Random.Shared.Next(500, 5001), ct);

        if (behavior == SupplierBehavior.Flaky && Random.Shared.NextDouble() < 0.30)
            throw new InvalidOperationException($"{name} is temporarily unavailable");

        return Math.Round((decimal)(50 + Random.Shared.NextDouble() * 450), 2);
    }
}
