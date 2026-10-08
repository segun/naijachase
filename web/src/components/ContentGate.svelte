<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import { ApiError, ContentApi } from "../api";
  import type { ContentRole } from "../model.ts";
  import Icon from "./Icon.svelte";

  let { app }: { app: AppController } = $props();
  let phase = $state<"checking" | "denied" | "ready" | "error">("checking");
  let role = $state<ContentRole>("editor");
  const api = new ContentApi();
  // The dashboard is a separate lazy chunk that ordinary players never download: it only loads after the server
  // confirms a content role, and only when someone navigates to #/content.
  let Dashboard = $state<typeof import("./ContentDashboard.svelte").default | null>(null);

  $effect(() => {
    let alive = true;
    api.role()
      .then(async r => {
        if (!alive) return;
        role = r.content_role;
        Dashboard = (await import("./ContentDashboard.svelte")).default;
        if (alive) phase = "ready";
      })
      .catch(e => { if (alive) phase = e instanceof ApiError && (e.status === 403 || e.status === 401) ? "denied" : "error"; });
    return () => { alive = false; };
  });
</script>

{#if phase === "checking"}
  <div class="page narrow"><p class="muted" role="status"><span class="spinner"></span> Checking access…</p></div>
{:else if phase === "ready" && Dashboard}
  <Dashboard {app} {api} {role} />
{:else}
  <div class="page narrow">
    <section class="card empty rise">
      <Icon name="lock" />
      <h1>{phase === "denied" ? "Content access required" : "Content tools unavailable"}</h1>
      <p class="muted">{phase === "denied" ? "This area is for the content team." : "We couldn't reach the content service. Try again shortly."}</p>
      <button class="btn btn-primary" type="button" onclick={() => { location.hash = ""; app.go("cases"); }}>Back to the case desk</button>
    </section>
  </div>
{/if}
