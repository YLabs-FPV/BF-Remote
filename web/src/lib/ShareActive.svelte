<script lang="ts">
  import { session } from "./session.svelte";
  import StatsPanel from "./StatsPanel.svelte";

  let copied = $state<string | null>(null);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = key;
      setTimeout(() => {
        if (copied === key) copied = null;
      }, 1500);
    } catch {
      /* clipboard blocked */
    }
  }
</script>

<div class="space-y-6">
  <div class="card rounded-2xl p-6 text-center sm:p-8">
    <div class="mb-4 flex items-center justify-center gap-2">
      <h2 class="section-label">Your code</h2>
      {#if session.fcOnline}
        <span class="pill pill-success">
          <span class="h-2 w-2 rounded-full bg-current"></span>
          Live
        </span>
      {:else}
        <span class="pill pill-accent">
          <span class="h-2 w-2 rounded-full bg-current"></span>
          FC offline
        </span>
      {/if}
    </div>

    <div
      class="mb-5 font-mono text-4xl font-bold tracking-[0.15em] sm:text-5xl"
    >
      {session.displayCode}
    </div>

    <div class="flex flex-wrap justify-center gap-2">
      <button
        class="btn btn-primary"
        onclick={() => session.displayCode && copy(session.displayCode, "code")}
      >
        {copied === "code" ? "Copied" : "Copy code"}
      </button>
      <button
        class="btn btn-ghost"
        onclick={() => session.shareUrl && copy(session.shareUrl, "url")}
      >
        {copied === "url" ? "Copied" : "Copy link"}
      </button>
    </div>
    <p class="mt-4 text-sm text-[rgb(var(--color-text-muted))]">
      Read this code to your helper, or send them the link.
    </p>

    {#if !session.fcOnline}
      <div
        class="mt-5 rounded-xl border border-[rgba(var(--color-accent),0.3)] bg-[rgba(var(--color-accent),0.1)] p-4 text-left"
      >
        <p class="mb-3 text-sm leading-relaxed text-[rgb(var(--color-text))]">
          Flight controller disconnected - your helper was dropped, but the code
          stays the same. Plug it back in and it reconnects automatically.
        </p>
        <button
          class="btn btn-primary w-full"
          onclick={() => session.reconnectFc()}
          disabled={session.reconnecting}
        >
          {session.reconnecting
            ? "Reconnecting…"
            : "Reconnect flight controller"}
        </button>
        <button
          class="mt-2 w-full text-center text-xs text-[rgb(var(--color-text))] underline"
          onclick={() => session.reconnectFc(true)}
        >
          Choose a different device
        </button>
      </div>
    {/if}

    <button class="btn btn-danger mt-6" onclick={() => session.stop()}>
      End session
    </button>
  </div>

  <div class="card flex items-center justify-center rounded-2xl px-6 py-4">
    {#if session.helpers.length === 0}
      <span class="pill pill-muted">Waiting for a helper…</span>
    {:else}
      <span class="pill pill-success">
        <span class="h-2 w-2 rounded-full bg-current"></span>
        {session.helpers.length === 1
          ? "Helper connected"
          : `${session.helpers.length} helpers connected`}
      </span>
    {/if}
  </div>

  <StatsPanel />
</div>
