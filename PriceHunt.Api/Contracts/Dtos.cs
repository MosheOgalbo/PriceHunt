namespace PriceHunt.Api.Contracts;

public sealed record SearchQuery(
    string? FromLocation, string? ToLocation, DateOnly? FromDate, DateOnly? ToDate, string[]? Suppliers);

public sealed record HistoryQuery(
    DateOnly? StartDate, DateOnly? EndDate, string[]? Suppliers,
    string? FromLocation, string? ToLocation,
    string? SortBy, string? SortDir, int? Page, int? PageSize);

public sealed record StreamEvent(string Type, object Data);

public sealed record StartedPayload(Guid SearchId, int TotalSuppliers, int MaxDurationSeconds);

public sealed record ResultPayload(
    Guid SearchId, string Supplier, decimal? Price, int ResponseTimeMs,
    bool Succeeded, string? Error, DateTime ReceivedAtUtc);

public sealed record EndedPayload(Guid SearchId, string Status, int Responded, int Total);

public sealed record HistoryItem(
    long Id, DateTime TimestampUtc, string FromLocation, string ToLocation,
    string Supplier, double? Price, int ResponseTimeMs, bool Succeeded, string? Error, string SearchStatus);

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
