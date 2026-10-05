namespace PriceHunt.Api.Domain;

public enum SearchStatus { Running, Completed, TimedOut, Cancelled }

public class SearchRecord
{
    public Guid Id { get; set; }
    public string FromLocation { get; set; } = "";
    public string ToLocation { get; set; } = "";
    public DateOnly FromDate { get; set; }
    public DateOnly ToDate { get; set; }
    public DateTime StartedAtUtc { get; set; }
    public DateTime? FinishedAtUtc { get; set; }
    public SearchStatus Status { get; set; }
    public List<SearchSupplier> SelectedSuppliers { get; set; } = [];
    public List<SupplierResponseRecord> Responses { get; set; } = [];
}

/// <summary>Suppliers chosen for a search. One row per supplier instead of a CSV string.</summary>
public class SearchSupplier
{
    public Guid SearchId { get; set; }
    public SearchRecord Search { get; set; } = null!;
    public string Supplier { get; set; } = "";
}

public class SupplierResponseRecord
{
    public long Id { get; set; }
    public Guid SearchId { get; set; }
    public SearchRecord Search { get; set; } = null!;
    public string Supplier { get; set; } = "";
    public double? Price { get; set; }
    public int ResponseTimeMs { get; set; }
    public DateTime TimestampUtc { get; set; }
    public bool Succeeded { get; set; }
    public string? Error { get; set; }
}
