using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using PriceHunt.Api.Contracts;
using PriceHunt.Api.Data;
using PriceHunt.Api.Services;
using PriceHunt.Api.Suppliers;

namespace PriceHunt.Api.Endpoints;

public static class ApiEndpoints
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static void MapApi(this WebApplication app)
    {
        app.MapGet("/health", Health);

        var api = app.MapGroup("/api");
        api.MapGet("/suppliers", (SearchService s) => s.SupplierNames);
        api.MapGet("/search", StreamSearch);
        api.MapPost("/search/cancel", (string? streamId, SearchSessionHub hub) =>
        {
            if (!string.IsNullOrWhiteSpace(streamId)) hub.CancelNow(streamId);
            return Results.NoContent();
        });
        api.MapGet("/history", async ([AsParameters] HistoryQuery q, HistoryService h, CancellationToken ct) =>
            Results.Ok(await h.QueryAsync(q, ct)));
    }

    private static async Task<IResult> Health(IDbContextFactory<PriceHuntDbContext> factory, CancellationToken ct)
    {
        try
        {
            await using var db = await factory.CreateDbContextAsync(ct);
            if (!await db.Database.CanConnectAsync(ct))
                return Results.Json(new { status = "Unhealthy", database = "sqlite" }, statusCode: StatusCodes.Status503ServiceUnavailable);
            return Results.Ok(new { status = "Healthy", database = "sqlite" });
        }
        catch (Exception ex)
        {
            return Results.Json(
                new { status = "Unhealthy", database = "sqlite", detail = ex.GetType().Name },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task StreamSearch(
        HttpContext ctx, [AsParameters] SearchQuery q, SearchService svc, SearchSessionHub hub, ILoggerFactory loggers)
    {
        var logger = loggers.CreateLogger("PriceHunt.SearchStream");
        var streamId = string.IsNullOrWhiteSpace(q.StreamId) ? Guid.NewGuid().ToString("N") : q.StreamId.Trim();
        var isResume = int.TryParse(ctx.Request.Headers["Last-Event-ID"], out var lastId) && hub.TryGet(streamId, out _);
        if (!isResume) lastId = 0;

        if (!isResume)
        {
            var errors = Validate(q, svc);
            if (errors.Count > 0)
            {
                await Results.ValidationProblem(errors).ExecuteAsync(ctx);
                return;
            }

            var criteria = new SearchCriteria(q.FromLocation!.Trim(), q.ToLocation!.Trim(), q.FromDate!.Value, q.ToDate!.Value);
            var selected = svc.Resolve(q.Suppliers);
            var session = hub.Start(streamId);
            _ = Task.Run(async () =>
            {
                try
                {
                    await foreach (var ev in svc.SearchAsync(criteria, selected, session.Work.Token))
                        hub.Append(session, ev.Type, ev.Data);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Search stream {StreamId} failed", streamId);
                }
                finally
                {
                    hub.MarkProducerDone(session);
                }
            });
        }
        else
        {
            logger.LogInformation("Resuming search stream {StreamId} after event {LastEventId}", streamId, lastId);
        }

        ctx.Response.Headers.ContentType = "text/event-stream";
        ctx.Response.Headers.CacheControl = "no-cache";
        ctx.Response.Headers["X-Accel-Buffering"] = "no";
        ctx.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        hub.ListenerAttached(streamId);
        try
        {
            await foreach (var entry in hub.Listen(streamId, lastId, ctx.RequestAborted))
            {
                var data = JsonSerializer.Serialize(entry.Data, Json);
                await ctx.Response.WriteAsync($"id: {entry.Id}\nevent: {entry.Type}\ndata: {data}\n\n", ctx.RequestAborted);
                await ctx.Response.Body.FlushAsync(ctx.RequestAborted);
            }
        }
        catch (OperationCanceledException)
        {
        }
        finally
        {
            hub.ListenerDetached(streamId);
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
