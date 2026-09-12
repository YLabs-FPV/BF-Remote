<script lang="ts">
  import HelpCard from "./lib/HelpCard.svelte";
  import { session } from "./lib/session.svelte";
  import ShareActive from "./lib/ShareActive.svelte";
  import ShareCard from "./lib/ShareCard.svelte";
</script>

<main class="mx-auto max-w-5xl px-4 py-10 sm:py-16">
  <header class="mb-8 text-center">
    <div
      class="hero-icon-wrap mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
    >
      <img src="/icon.svg" alt="Logo" class="h-7 w-7" />
    </div>
    <h1 class="text-3xl font-bold">Remote</h1>
    <p class="text-sm text-[rgb(var(--color-text-muted))]">
      by <a
        class="text-[rgb(var(--color-primary))] hover:text-[rgb(var(--color-primary-hover))] transition-colors"
        href="https://yarosfpv.com"
        target="_blank"
        rel="noopener noreferrer">YarosFPV</a
      >
    </p>
    <p
      class="mx-auto max-w-md mt-4 leading-relaxed text-[rgb(var(--color-text-muted))]"
    >
      Let someone you trust configure your quad from anywhere through the
      official Betaflight Configurator
    </p>
  </header>

  {#if session.status === "connecting"}
    <div
      class="card mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl p-10 text-center"
    >
      <div
        class="h-8 w-8 animate-spin rounded-full border-2 border-[rgb(var(--color-border))] border-t-[rgb(var(--color-primary))]"
      ></div>
      <p class="text-[rgb(var(--color-text-muted))]">
        Connecting to your flight controller…
      </p>
      <button
        class="text-sm text-[rgb(var(--color-text-muted))] underline hover:text-[rgb(var(--color-text))]"
        onclick={() => session.stop()}
      >
        Cancel
      </button>
    </div>
  {:else if session.status === "sharing"}
    <div class="mx-auto max-w-md">
      <ShareActive />
    </div>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2">
      <ShareCard />
      <HelpCard />
    </div>
  {/if}

  <footer
    class="mt-8 text-center text-xs leading-relaxed text-[rgb(var(--color-text-muted))]"
  >
    Not affiliated with Betaflight. Works with the official Betaflight
    Configurator.
  </footer>
</main>
