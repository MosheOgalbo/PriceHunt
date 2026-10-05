using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PriceHunt.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Searches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    FromLocation = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    ToLocation = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    FromDate = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    ToDate = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    StartedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    FinishedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Searches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Responses",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SearchId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Supplier = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Price = table.Column<double>(type: "REAL", nullable: true),
                    ResponseTimeMs = table.Column<int>(type: "INTEGER", nullable: false),
                    TimestampUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Succeeded = table.Column<bool>(type: "INTEGER", nullable: false),
                    Error = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Responses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Responses_Searches_SearchId",
                        column: x => x.SearchId,
                        principalTable: "Searches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SearchSuppliers",
                columns: table => new
                {
                    SearchId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Supplier = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SearchSuppliers", x => new { x.SearchId, x.Supplier });
                    table.ForeignKey(
                        name: "FK_SearchSuppliers_Searches_SearchId",
                        column: x => x.SearchId,
                        principalTable: "Searches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Responses_SearchId",
                table: "Responses",
                column: "SearchId");

            migrationBuilder.CreateIndex(
                name: "IX_Responses_Supplier",
                table: "Responses",
                column: "Supplier");

            migrationBuilder.CreateIndex(
                name: "IX_Responses_TimestampUtc",
                table: "Responses",
                column: "TimestampUtc");

            migrationBuilder.CreateIndex(
                name: "IX_Searches_StartedAtUtc",
                table: "Searches",
                column: "StartedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_SearchSuppliers_Supplier",
                table: "SearchSuppliers",
                column: "Supplier");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Responses");

            migrationBuilder.DropTable(
                name: "SearchSuppliers");

            migrationBuilder.DropTable(
                name: "Searches");
        }
    }
}
