<script lang="ts">
  import type { SessionStatus } from "@bf-remote/shared";
  import { isPartialCode, resolveInput } from "./code";

  let raw = $state("");
  let status = $state<SessionStatus | null>(null);
  let checking = $state(false);
  let copied = $state(false);

  const resolved = $derived(resolveInput(raw));
  const invalid = $derived(
    raw.trim().length > 0 && resolved === null && !isPartialCode(raw),
  );

  const inputClass = $derived(
    "w-full rounded-lg border bg-[rgb(var(--color-secondary))] px-4 py-3 text-center font-mono text-lg uppercase tracking-widest text-[rgb(var(--color-text))] " +
      (invalid
        ? "border-red-500 focus:border-red-500"
        : "border-[rgb(var(--color-border))] focus:border-[rgb(var(--color-primary))]"),
  );

  $effect(() => {
    const c = resolved?.code;
    status = null;
    if (!c) return;

    let cancelled = false;

    async function check() {
      checking = status === null;
      try {
        const res = await fetch(`/api/session/${c}`);
        if (!cancelled)
          status = res.ok ? ((await res.json()) as SessionStatus) : null;
      } catch {
        if (!cancelled) status = null;
      } finally {
        if (!cancelled) checking = false;
      }
    }

    const debounce = setTimeout(check, 400);
    const interval = setInterval(check, 3000);

    return () => {
      cancelled = true;
      checking = false;
      clearTimeout(debounce);
      clearInterval(interval);
    };
  });

  async function copy() {
    if (!resolved) return;
    try {
      await navigator.clipboard.writeText(resolved.url);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }
</script>

<div class="card flex flex-col rounded-2xl p-6 sm:p-8">
  <h2 class="section-label mb-5">Help someone</h2>
  <p class="mb-3 text-sm text-[rgb(var(--color-text-muted))]">
    Enter the code they gave you, or paste the link.
  </p>

  <input
    class={inputClass}
    placeholder="ABCD-2345"
    autocomplete="off"
    autocapitalize="off"
    spellcheck="false"
    bind:value={raw}
  />

  {#if invalid}
    <p class="mt-2 text-sm text-red-500">That's not a valid code or link.</p>
  {/if}

  {#if resolved}
    <div class="mt-3">
      {#if checking}
        <span class="pill pill-muted">Checking…</span>
      {:else if status?.fc}
        <span class="pill pill-success">
          <span class="h-2 w-2 rounded-full bg-current"></span>
          Flight controller online
        </span>
      {:else}
        <span class="pill pill-muted">Not connected yet</span>
      {/if}
    </div>

    <div class="mt-4 flex items-stretch gap-2">
      <code
        class="min-w-0 flex-1 truncate rounded-lg bg-[rgb(var(--color-secondary))] px-4 py-3 font-mono text-sm"
      >
        {resolved.url}
      </code>
      <button class="btn btn-primary shrink-0" onclick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
    <p class="mt-3 text-sm leading-relaxed text-[rgb(var(--color-text-muted))]">
      In <a
        class="text-[rgb(var(--color-primary))] underline"
        href="https://app.betaflight.com/"
        target="_blank"
        rel="noopener noreferrer">Betaflight Configurator</a
      >, open the connection dropdown, choose
      <strong class="text-[rgb(var(--color-text))]">Manual</strong>, paste this
      link, and press Connect.
      <br />
      <span class="text-[rgb(var(--color-text-muted))]"
        >Expert mode must be enabled</span
      >
    </p>
  {/if}
</div>
