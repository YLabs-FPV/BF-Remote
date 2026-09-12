<script lang="ts">
  import { session } from "./session.svelte";

  const supported = session.serialSupported;

  const steps = [
    "Plug your flight controller into this computer.",
    "Select it below and press Connect.",
    "Read the code to your helper.",
  ];

  $effect(() => {
    if (supported) session.refreshPorts();
  });
</script>

<div class="card flex flex-col rounded-2xl p-6 sm:p-8">
  <h2 class="section-label mb-5">Share your quad</h2>

  {#if !supported}
    <p class="mb-5 rounded-lg border border-[rgba(var(--color-accent),0.3)] bg-[rgba(var(--color-accent),0.1)] px-4 py-3 text-sm text-[rgb(var(--color-accent))]">
      This browser doesn't support Web Serial. Open the page in
      <strong>Chrome</strong> or <strong>Edge</strong> on desktop to share a flight
      controller.
    </p>
  {/if}

  <ol
    class="mb-6 flex-1 space-y-4"
    class:opacity-50={!supported}
  >
    {#each steps as step, i}
      <li class="flex items-start gap-3">
        <span
          class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-secondary))] text-sm font-bold text-[rgb(var(--color-text-muted))]"
        >
          {i + 1}
        </span>
        <span class="leading-snug">{step}</span>
      </li>
    {/each}
  </ol>

  <div class="mb-3 flex gap-2">
    <select
      class="min-w-0 flex-1 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-secondary))] px-3 py-2.5 text-sm text-[rgb(var(--color-text))]"
      bind:value={session.selectedId}
      disabled={!supported || session.ports.length === 0}
    >
      {#if session.ports.length === 0}
        <option value={null}>No device - add one</option>
      {:else}
        {#each session.ports as port (port.id)}
          <option value={port.id}>{port.label}</option>
        {/each}
      {/if}
    </select>
    <button
      class="btn btn-ghost shrink-0"
      onclick={() => session.addDevice()}
      disabled={!supported}
    >
      Add
    </button>
  </div>

  {#if session.error}
    <p
      class="mb-4 rounded-lg border border-[rgba(var(--color-accent),0.3)] bg-[rgba(var(--color-accent),0.1)] px-4 py-3 text-sm text-[rgb(var(--color-accent))]"
    >
      {session.error}
    </p>
  {/if}

  <button
    class="btn btn-primary w-full"
    onclick={() => session.start()}
    disabled={!supported}
  >
    Connect flight controller
  </button>
  <p class="mt-3 text-center text-xs text-[rgb(var(--color-text-muted))]">
    Requires Chrome or Edge on desktop.
  </p>
</div>
