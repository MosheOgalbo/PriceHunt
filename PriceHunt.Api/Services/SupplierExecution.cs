namespace PriceHunt.Api.Services;

/// <summary>
/// Per-supplier attempt budget, one retry, and a small circuit breaker.
/// Timeouts and cancellations do not open the circuit, so a supplier that never
/// answers still occupies the search window instead of being skipped.
/// </summary>
public sealed class SupplierExecutionOptions
{
    public static readonly SupplierExecutionOptions Default = new();

    public int MaxAttempts { get; init; } = 2;
    public TimeSpan AttemptTimeout { get; init; } = TimeSpan.FromMilliseconds(5500);
    public int FailureThreshold { get; init; } = 4;
    public TimeSpan BreakDuration { get; init; } = TimeSpan.FromSeconds(20);
}

public sealed class SupplierCircuitBreaker(SupplierExecutionOptions options)
{
    private readonly object _gate = new();
    private readonly Dictionary<string, BreakerState> _states = new(StringComparer.OrdinalIgnoreCase);

    public bool Allow(string supplier)
    {
        lock (_gate)
        {
            if (!_states.TryGetValue(supplier, out var state) || state.OpenUntil is null)
                return true;
            return DateTime.UtcNow >= state.OpenUntil;
        }
    }

    public void RecordSuccess(string supplier)
    {
        lock (_gate) _states.Remove(supplier);
    }

    public void RecordFailure(string supplier)
    {
        lock (_gate)
        {
            if (!_states.TryGetValue(supplier, out var state))
            {
                state = new BreakerState();
                _states[supplier] = state;
            }

            state.Consecutive++;
            if (state.Consecutive >= options.FailureThreshold)
                state.OpenUntil = DateTime.UtcNow.Add(options.BreakDuration);
        }
    }

    private sealed class BreakerState
    {
        public int Consecutive;
        public DateTime? OpenUntil;
    }
}
