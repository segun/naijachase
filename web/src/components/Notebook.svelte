<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import { FIELDS, FIELD_META, dossierCount } from "../model.ts";
  import Icon from "./Icon.svelte";

  let { app }: { app: AppController } = $props();
  const gs = $derived(app.game!.state);
</script>

<div class="page">
  <header class="page-head rise">
    <p class="eyebrow">Detective notebook</p>
    <h1>What we know</h1>
    <p>Compare accounts across stops. A destination only makes sense where the clues intersect.</p>
  </header>

  <div class="split">
    <section class="notebook rise" aria-label="Witness accounts">
      <h2>Witness accounts</h2>
      {#each app.groupedNotes as group}
        <div class="notebook-stop">
          <h3><Icon name="pin" />{group.stop}</h3>
          <ol>
            {#each group.notes as note}
              <li><span class="who">{note.venue}</span>{note.message}</li>
            {/each}
          </ol>
        </div>
      {:else}
        <p class="paper-empty">No accounts recorded yet. Question a witness to start filling these pages.</p>
        <button class="btn" type="button" onclick={() => app.go("investigate")}>Go to the scene</button>
      {/each}
    </section>

    <aside class="stack side-rail">
      <section class="card">
        <h2>Journey</h2>
        <ol class="trail">
          {#each app.trail as stop, i}
            <li class:current={i === app.trail.length - 1}><span class="dot"></span>{stop}{#if i === app.trail.length - 1}<span class="badge badge-gold">Here</span>{/if}</li>
          {/each}
        </ol>
      </section>
      <section class="card">
        <h2>Suspect profile</h2>
        <p class="muted">{dossierCount(gs.dossier)} of 8 details recorded.</p>
        <dl class="profile-list">
          {#each FIELDS as field}
            <div class:blank={!gs.dossier[field]}><dt>{FIELD_META[field].label}</dt><dd>{gs.dossier[field] || "Unknown"}</dd></div>
          {/each}
        </dl>
        <button class="btn btn-block" type="button" onclick={() => app.go("dossier")}><Icon name="pencil" />Edit dossier</button>
      </section>
    </aside>
  </div>
</div>
