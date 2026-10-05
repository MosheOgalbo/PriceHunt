using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PriceHunt.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class PriceToCents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "PriceCents",
                table: "Responses",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE Responses
                SET PriceCents = CAST(ROUND(Price * 100) AS INTEGER)
                WHERE Price IS NOT NULL;
                """);

            migrationBuilder.DropColumn(
                name: "Price",
                table: "Responses");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Price",
                table: "Responses",
                type: "REAL",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE Responses
                SET Price = PriceCents / 100.0
                WHERE PriceCents IS NOT NULL;
                """);

            migrationBuilder.DropColumn(
                name: "PriceCents",
                table: "Responses");
        }
    }
}
