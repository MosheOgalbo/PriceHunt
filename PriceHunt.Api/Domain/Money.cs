namespace PriceHunt.Api.Domain;

/// <summary>Money helpers: suppliers return decimal dollars; storage uses integer cents.</summary>
public static class Money
{
    public static long? ToCents(decimal? dollars) =>
        dollars is null ? null : (long)Math.Round(dollars.Value * 100m, MidpointRounding.AwayFromZero);

    public static decimal? ToDollars(long? cents) =>
        cents is null ? null : cents.Value / 100m;
}
