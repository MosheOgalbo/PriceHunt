using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using PriceHunt.Api.Data;
using PriceHunt.Api.Endpoints;
using PriceHunt.Api.Services;
using PriceHunt.Api.Suppliers;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContextFactory<PriceHuntDbContext>(o =>
    o.UseSqlite(builder.Configuration.GetConnectionString("Default") ?? "Data Source=pricehunt.db"));

// Seven simulated suppliers behind one interface.
(string Name, SupplierBehavior Behavior)[] suppliers =
[
    ("AeroFreight", SupplierBehavior.Normal),
    ("BlueWave Shipping", SupplierBehavior.Normal),
    ("CargoNova", SupplierBehavior.Normal),
    ("DirectLine Express", SupplierBehavior.Normal),
    ("EuroHaul", SupplierBehavior.Normal),
    ("FlexiShip", SupplierBehavior.Flaky),
    ("GlobalPort", SupplierBehavior.NeverResponds),
];
foreach (var (name, behavior) in suppliers)
    builder.Services.AddSingleton<ISupplier>(new SimulatedSupplier(name, behavior));

// Factory registration: the optional timeout argument is for tests. The host keeps the 6s default.
builder.Services.AddSingleton(sp => new SearchService(
    sp.GetRequiredService<IDbContextFactory<PriceHuntDbContext>>(),
    sp.GetServices<ISupplier>()));
builder.Services.AddSingleton<HistoryService>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins("http://localhost:4200", "http://127.0.0.1:4200").AllowAnyHeader().AllowAnyMethod()));
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));

var app = builder.Build();

await using (var db = await app.Services.GetRequiredService<IDbContextFactory<PriceHuntDbContext>>().CreateDbContextAsync())
    await db.Database.EnsureCreatedAsync();

app.UseCors();
app.MapApi();
app.Run("http://localhost:5080");
