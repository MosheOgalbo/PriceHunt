using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using PriceHunt.Api.Contracts;
using PriceHunt.Api.Services;
using PriceHunt.Api.Suppliers;

namespace PriceHunt.Api.Endpoints;

public static class ApiEndpoints
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static void MapApi(this WebApplication app)
    {
        var api = app.MapGroup("/api");

        api.MapGet("/suppliers", (SearchService s) => s.SupplierNames);

        api.MapGet("/search", StreamSearch);

        api.MapGet("/history", async ([AsParameters] HistoryQuery q, HistoryService h, CancellationToken ct) =>
            Results.Ok(await h.QueryAsync(q, ct)));
    }

    private static async Task StreamSearch(HttpContext ctx, [AsParameters] SearchQuery q, SearchService svc)
    {
        var errors = Validate(q, svc);
        if (errors.Count > 0)
        {
            await Results.ValidationProblem(errors).ExecuteAsync(ctx);
            return;
        }

        var criteria = new SearchCriteria(q.FromLocation!.Trim(), q.ToLocation!.Trim(), q.FromDate!.Value, q.ToDate!.Value);
        var selected = svc.Resolve(q.Suppliers);

        ctx.Response.Headers.ContentType = "text/event-stream";
        ctx.Response.Headers.CacheControl = "no-cache";
        ctx.Response.Headers["X-Accel-Buffering"] = "no";
        ctx.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        try
        {
            await foreach (var ev in svc.SearchAsync(criteria, selected, ctx.RequestAborted))
            {
                var data = JsonSerializer.Serialize(ev.Data, Json);
                await ctx.Response.WriteAsync($"event: {ev.Type}\ndata: {data}\n\n", ctx.RequestAborted);
                await ctx.Response.Body.FlushAsync(ctx.RequestAborted);
            }
        }
        catch (OperationCanceledException)
        {
        }
    }

    private static Dictionary<string, string[]> Validate(SearchQuery q, SearchService svc)
    {
        var e = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(q.FromLocation)) e[nameof(q.FromLocation)] = ["From location is required"];
        if (string.IsNullOrWhiteSpace(q.ToLocation)) e[nameof(q.ToLocation)] = ["To location is required"];
        if (q.FromDate is null) e[nameof(q.FromDate)] = ["From date is required"];
        if (q.ToDate is null) e[nameof(q.ToDate)] = ["To date is required"];
        if (q.FromDate > q.ToDate) e[nameof(q.ToDate)] = ["To date must not be before from date"];
        if (q.Suppliers?.Any(n => !svc.SupplierNames.Contains(n, StringComparer.OrdinalIgnoreCase)) == true)
            e[nameof(q.Suppliers)] = ["Unknown supplier"];
        return e;
    }
}
