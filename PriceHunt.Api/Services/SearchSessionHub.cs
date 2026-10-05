using System.Runtime.CompilerServices;

namespace PriceHunt.Api.Services;

/// <summary>
/// Buffers SSE events per stream so a dropped connection can resume with Last-Event-ID.
/// An explicit cancel stops supplier work immediately. A disconnect without cancel
/// keeps the search alive for <see cref="DisconnectGrace"/> so the browser can reconnect.
/// </summary>
public sealed class SearchSessionHub
{
    public TimeSpan DisconnectGrace { get; set; } = TimeSpan.FromSeconds(1);
    public TimeSpan Retention { get; set; } = TimeSpan.FromMinutes(2);

    private readonly object _gate = new();
    private readonly Dictionary<string, Session> _sessions = new(StringComparer.Ordinal);

    public sealed record LogEntry(int Id, string Type, object Data);

    public Session Start(string streamId)
    {
        lock (_gate)
        {
            if (_sessions.Remove(streamId, out var previous))
            {
                previous.Superseded = true;
                previous.Grace?.Cancel();
                previous.Work.Cancel();
                Pulse(previous);
            }

            var session = new Session();
            _sessions[streamId] = session;
            return session;
        }
    }

    public bool TryGet(string streamId, out Session? session)
    {
        lock (_gate)
        {
            var found = _sessions.TryGetValue(streamId, out var existing);
            session = existing;
            return found;
        }
    }

    public LogEntry Append(Session session, string type, object data)
    {
        lock (_gate)
        {
            var entry = new LogEntry(session.NextId++, type, data);
            session.Events.Add(entry);
            Pulse(session);
            return entry;
        }
    }

    public void MarkProducerDone(Session session)
    {
        string? streamId = null;
        lock (_gate)
        {
            session.ProducerDone = true;
            Pulse(session);
            streamId = _sessions.FirstOrDefault(p => ReferenceEquals(p.Value, session)).Key;
        }

        if (streamId is null) return;
        var id = streamId;
        _ = Task.Delay(Retention).ContinueWith(_ =>
        {
            lock (_gate)
            {
                if (_sessions.TryGetValue(id, out var current) && ReferenceEquals(current, session))
                    _sessions.Remove(id);
            }
        }, TaskScheduler.Default);
    }

    public void CancelNow(string streamId)
    {
        Session? session;
        lock (_gate)
        {
            if (!_sessions.TryGetValue(streamId, out session)) return;
            session.Grace?.Cancel();
            session.Grace = null;
        }

        session.Work.Cancel();
    }

    public void ListenerAttached(string streamId)
    {
        lock (_gate)
        {
            if (!_sessions.TryGetValue(streamId, out var session)) return;
            session.Listeners++;
            session.Grace?.Cancel();
            session.Grace = null;
        }
    }

    public void ListenerDetached(string streamId)
    {
        CancellationToken graceToken;
        lock (_gate)
        {
            if (!_sessions.TryGetValue(streamId, out var session)) return;
            session.Listeners = Math.Max(0, session.Listeners - 1);
            if (session.Listeners > 0 || session.ProducerDone || session.Superseded) return;

            session.Grace?.Cancel();
            session.Grace = new CancellationTokenSource();
            graceToken = session.Grace.Token;
        }

        _ = Task.Delay(DisconnectGrace, graceToken).ContinueWith(t =>
        {
            if (!t.IsCanceled) CancelNow(streamId);
        }, CancellationToken.None, TaskContinuationOptions.None, TaskScheduler.Default);
    }

    public async IAsyncEnumerable<LogEntry> Listen(
        string streamId, int afterId, [EnumeratorCancellation] CancellationToken ct)
    {
        var cursor = afterId;
        while (!ct.IsCancellationRequested)
        {
            LogEntry[] batch;
            Task wait;
            bool done;
            bool missing;
            lock (_gate)
            {
                missing = !_sessions.TryGetValue(streamId, out var session);
                if (missing || session is null)
                {
                    batch = [];
                    done = true;
                    wait = Task.CompletedTask;
                }
                else
                {
                    batch = session.Events.Where(e => e.Id > cursor).ToArray();
                    done = session.ProducerDone && batch.Length == 0;
                    wait = session.Pulse.Task;
                }
            }

            if (missing) yield break;

            foreach (var entry in batch)
            {
                cursor = entry.Id;
                yield return entry;
            }

            if (done) yield break;
            if (batch.Length > 0) continue;

            try
            {
                await wait.WaitAsync(ct);
            }
            catch (OperationCanceledException)
            {
                yield break;
            }
        }
    }

    private static void Pulse(Session session)
    {
        var current = session.Pulse;
        session.Pulse = NewPulse();
        current.TrySetResult();
    }

    private static TaskCompletionSource NewPulse() =>
        new(TaskCreationOptions.RunContinuationsAsynchronously);

    public sealed class Session
    {
        public CancellationTokenSource Work { get; } = new();
        public List<LogEntry> Events { get; } = [];
        public int NextId { get; set; } = 1;
        public bool ProducerDone { get; set; }
        public bool Superseded { get; set; }
        public int Listeners { get; set; }
        public CancellationTokenSource? Grace { get; set; }
        public TaskCompletionSource Pulse { get; set; } = NewPulse();
    }
}
