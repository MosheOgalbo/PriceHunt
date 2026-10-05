namespace PriceHunt.Api.Services;

/// <summary>
/// Per-supplier attempt budget. Default is one attempt so FlexiShip's ~30% failure
/// rate stays visible. Set <see cref="MaxAttempts"/> to 2 for an optional retry.
/// </summary>
public sealed class SupplierExecutionOptions
{
    public static readonly SupplierExecutionOptions Default = new();

    public int MaxAttempts { get; init; } = 1;
    public TimeSpan AttemptTimeout { get; init; } = TimeSpan.FromMilliseconds(5500);
}
