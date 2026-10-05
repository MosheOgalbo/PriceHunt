using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PriceHunt.Api.Data;

/// <summary>Used by <c>dotnet ef</c> so migrations can be created without starting the web host.</summary>
public sealed class PriceHuntDbContextFactory : IDesignTimeDbContextFactory<PriceHuntDbContext>
{
    public PriceHuntDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<PriceHuntDbContext>()
            .UseSqlite("Data Source=pricehunt.db")
            .Options;
        return new PriceHuntDbContext(options);
    }
}
