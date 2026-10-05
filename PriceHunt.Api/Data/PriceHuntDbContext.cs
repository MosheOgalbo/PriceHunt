using Microsoft.EntityFrameworkCore;
using PriceHunt.Api.Domain;

namespace PriceHunt.Api.Data;

public class PriceHuntDbContext(DbContextOptions<PriceHuntDbContext> options) : DbContext(options)
{
    public DbSet<SearchRecord> Searches => Set<SearchRecord>();
    public DbSet<SearchSupplier> SearchSuppliers => Set<SearchSupplier>();
    public DbSet<SupplierResponseRecord> Responses => Set<SupplierResponseRecord>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<SearchRecord>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.FromLocation).HasMaxLength(200).IsRequired();
            e.Property(x => x.ToLocation).HasMaxLength(200).IsRequired();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(x => x.StartedAtUtc);
            e.HasMany(x => x.Responses).WithOne(x => x.Search)
                .HasForeignKey(x => x.SearchId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.SelectedSuppliers).WithOne(x => x.Search)
                .HasForeignKey(x => x.SearchId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<SearchSupplier>(e =>
        {
            e.HasKey(x => new { x.SearchId, x.Supplier });
            e.Property(x => x.Supplier).HasMaxLength(100);
            e.HasIndex(x => x.Supplier);
        });

        b.Entity<SupplierResponseRecord>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Supplier).HasMaxLength(100).IsRequired();
            e.Property(x => x.Error).HasMaxLength(500);
            e.HasIndex(x => x.Supplier);
            e.HasIndex(x => x.TimestampUtc);
        });
    }
}
