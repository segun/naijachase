<script lang="ts">
  import "../../styles/profile-list.css";
  import type { AppController } from "../../state/app.svelte";
  import { onMount, tick } from "svelte";
  import { FIELDS, FIELD_META, dossierCount } from "../../domain/model.ts";
  import type { Note } from "../../domain/model.ts";
  import Icon from "../../ui/Icon.svelte";
  import Ledger from "./Ledger.svelte";

  let { app, focus = null }: { app: AppController; focus?: { stop: string; venueId: string; venueLabel: string } | null } = $props();
  const gs = $derived(app.game!.state);
  let focusedNote = $state<Note | null>(null);
  const normalizeVenue = (venue: string) => venue.trim().replaceAll("_", " ").replace(/\s+/g, " ").toLocaleLowerCase();

  onMount(async () => {
    await app.refreshWitnessAccounts();
    if (!focus) return;
    focusedNote = app.notes.find(note =>
      note.stop === focus.stop &&
      (note.venueId === focus.venueId || (!note.venueId && normalizeVenue(note.venue) === normalizeVenue(focus.venueLabel)))
    ) ?? null;
    if (!focusedNote) return;
    await tick();
    document.querySelector<HTMLElement>(".notebook [data-focused-note]")?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
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
      {#if app.notesLoading}<p role="status">Restoring saved witness accounts…</p>{/if}
      {#if app.notesError}
        <p role="alert">{app.notesError}</p>
        <button class="btn" type="button" disabled={app.notesLoading} onclick={() => app.refreshWitnessAccounts()}>Retry loading accounts</button>
      {/if}
      {#each app.groupedNotes as group}
        <div class="notebook-stop">
          <h3><Icon name="pin" />{group.stop}</h3>
          <ol>
            {#each group.notes as note}
            <li class:focused={note === focusedNote} data-focused-note={note === focusedNote ? "" : undefined} aria-current={note === focusedNote ? "location" : undefined}><span class="who">{note.venue}</span>{note.message}</li>
            {/each}
          </ol>
        </div>
      {:else}
        {#if !app.notesLoading && !app.notesError}<p class="paper-empty">No accounts recorded yet. Question a witness to start filling these pages.</p>{/if}
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
      <Ledger {app} />
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
