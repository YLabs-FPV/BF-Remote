<script lang="ts">
  import { session } from "./session.svelte";

  let now = $state(Date.now());

  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(id);
  });

  function bytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function duration(ms: number): string {
    const s = Math.floor(ms / 1000);
    const pad = (x: number) => String(x).padStart(2, "0");
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
  }

  // Reading `now` makes this recompute every second, refreshing the plain counters.
  const rows = $derived.by(() => {
    now;
    return [
      { label: "Relay latency", value: session.latencyMs === null ? "—" : `${session.latencyMs} ms` },
      { label: "Uptime", value: duration(session.uptimeMs) },
      { label: "From FC", value: bytes(session.bytesFromFc) },
      { label: "To FC", value: bytes(session.bytesToFc) },
      { label: "Helpers", value: String(session.helpers.length) },
      { label: "FC link", value: session.fcOnline ? "online" : "offline" },
    ];
  });
</script>

<div class="card rounded-2xl px-6 py-4">
  <h2 class="section-label mb-4">Stats</h2>
  <dl class="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
    {#each rows as row}
      <div class="flex items-center justify-between gap-4 border-b border-[rgb(var(--color-border))] pb-1">
        <dt class="text-[rgb(var(--color-text-muted))]">{row.label}</dt>
        <dd class="font-mono">{row.value}</dd>
      </div>
    {/each}
  </dl>
</div>
