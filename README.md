# catch-me-up

A Claude Code mod for people who orient by listening. It adds a **Catch me up** button above the prompt. Press it in a thread you have forgotten and Claude tells you, out loud, in under a minute:

1. What the thread is for.
2. What it needs from you (the single most important thing, and how many others are waiting).
3. Where the work stands.
4. What happens next.

**Stop** cuts it off after the current sentence, **Say it again** replays the last briefing, and `/catchup` does the same as the button.

## Install

At the prompt of a terminal session:

```
/plugin install catch-me-up --marketplace twlines/catch-me-up
```

Answer `y` to add the marketplace, then pick a scope (user scope puts it in every session).

From a shell:

```
claude plugin install catch-me-up --marketplace twlines/catch-me-up
```

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `twlines/catch-me-up`, then **Add plugin**.

## Voice

Speech uses the computer's own synthesizer (`say` on macOS), so nothing leaves the machine beyond the usual model call that writes the briefing. The default macOS voices sound robotic. For a natural one, download a Premium voice in **System Settings → Accessibility → Spoken Content → System Voice → Manage Voices**.

The mod uses the first of these it finds installed, then falls back to the system voice: Jamie (Premium), Lee (Premium), Fiona (Enhanced), then Ava, Zoe, Evan, Nathan (Premium), then Ava, Zoe, Evan, Samantha (Enhanced). To prefer another voice, edit the `VOICES` list at the top of `hooks/register.tsx`.

## How the briefing is made

In a live thread the briefing is written from the whole conversation. In a thread that was just reopened, it is written from the opening request and the most recent 40 messages.

## License

MIT
