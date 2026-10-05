using PriceHunt.Api.Services;

namespace PriceHunt.Api.Tests;

public sealed class SearchSessionHubTests
{
    [Fact]
    public async Task Listen_replays_events_after_the_last_id()
    {
        var hub = new SearchSessionHub();
        var session = hub.Start("stream-1");
        hub.Append(session, "started", "a");
        hub.Append(session, "result", "b");
        hub.MarkProducerDone(session);

        var all = new List<string>();
        await foreach (var entry in hub.Listen("stream-1", 0, CancellationToken.None))
            all.Add($"{entry.Id}:{entry.Type}");

        var tail = new List<int>();
        await foreach (var entry in hub.Listen("stream-1", 1, CancellationToken.None))
            tail.Add(entry.Id);

        Assert.Equal(["1:started", "2:result"], all);
        Assert.Equal([2], tail);
    }

    [Fact]
    public async Task Disconnect_cancels_the_search_after_the_grace_period()
    {
        var hub = new SearchSessionHub { DisconnectGrace = TimeSpan.FromMilliseconds(40) };
        var session = hub.Start("stream-2");
        hub.ListenerAttached("stream-2");
        hub.ListenerDetached("stream-2");

        await Task.Delay(250);

        Assert.True(session.Work.IsCancellationRequested);
    }

    [Fact]
    public async Task Reconnect_within_the_grace_period_keeps_the_search_alive()
    {
        var hub = new SearchSessionHub { DisconnectGrace = TimeSpan.FromMilliseconds(200) };
        var session = hub.Start("stream-3");
        hub.ListenerAttached("stream-3");
        hub.ListenerDetached("stream-3");
        hub.ListenerAttached("stream-3");

        await Task.Delay(350);

        Assert.False(session.Work.IsCancellationRequested);
    }
}
