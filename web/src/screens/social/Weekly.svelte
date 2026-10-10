<script lang="ts">
  import { untrack } from "svelte";
  import type { AppController } from "../../state/app.svelte";
  import { canManageGroup, countdown, eventLabel, myRole, notificationLabel, parseUtc, sortStandings, utcFromUnix, weeklyStatus } from "../../domain/model.ts";
  import { formatWhen } from "../../domain/pressure.ts";
  import Icon from "../../ui/Icon.svelte";
  import MoveDialog from "../case/MoveDialog.svelte";
  import WeeklyPlay from "./WeeklyPlay.svelte";

  let { app }: { app: AppController } = $props();
  const g = $derived(app.groups);
  const group = $derived(g.selected);
  const me = $derived(app.player?.username ?? "");
  const canCancel = $derived(group ? canManageGroup(myRole(group, me)) : false);
  const status = $derived(g.details ? weeklyStatus(g.details.status) : null);
  const open = $derived(g.details?.status === "open");
  const standings = $derived(g.details ? sortStandings(g.details.standings, g.details.winner_attempt_id) : []);
  let now = $state(Date.now());
  let cancelling = $state(false), reason = $state("");
  let web = $state(untrack(() => g.notifyPrefs.web)), email = $state(untrack(() => g.notifyPrefs.email));

  // The countdown is a display aid; the server clock decides eligibility and closure.
  $effect(() => { const t = setInterval(() => (now = Date.now()), 1000); return () => clearInterval(t); });
  $effect(() => { void g.load(); return () => g.stopPolling(); });
  const ends = $derived(g.current ? countdown(utcFromUnix(g.current.ends_at_unix), now) : null);
  const startsIn = $derived(g.current ? countdown(utcFromUnix(g.current.starts_at_unix), now) : null);
  const notStarted = $derived(g.current ? now < utcFromUnix(g.current.starts_at_unix) : false);
  const fmt = (ms: number) => new Date(ms).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
</script>

<div class="page">
  <header class="page-head rise">
    <p class="eyebrow">Weekly challenge</p>
    <h1>{group ? group.name : "Weekly challenge"}</h1>
    <p>Every Monday 07:00 (Lagos time) your group races to catch the same thief. The first valid capture wins and ends the week. Your ordinary case carries on in parallel.</p>
  </header>

  {#if !group}
    <section class="card empty rise"><Icon name="users" /><h2>Choose a group first</h2><p class="muted">Weekly challenges belong to a group.</p><button class="btn btn-primary" type="button" onclick={() => app.go("groups")}>Go to groups</button></section>
  {:else}
    {#if g.groups.length > 1}
      <div class="segmented" role="group" aria-label="Choose a group">
        {#each g.groups as x (x.group_id)}<button type="button" aria-pressed={x.group_id === g.selectedId} onclick={() => g.select(x.group_id)}>{x.name}</button>{/each}
      </div>
    {/if}

    <div class="split">
      <section class="stack">
        <section class="card rise" aria-labelledby="chal-title">
          <div class="row-between">
            <h2 id="chal-title">This week</h2>
            {#if status}<span class="badge badge-{status.tone === 'muted' ? '' : status.tone}">{status.label}</span>{/if}
          </div>
          {#if g.current && g.details}
            <dl class="facts">
              <div><dt>Opens</dt><dd>{fmt(utcFromUnix(g.current.starts_at_unix))}</dd></div>
              <div><dt>Closes</dt><dd>{fmt(utcFromUnix(g.current.ends_at_unix))}</dd></div>
              <div><dt>{notStarted ? "Starts in" : "Time left"}</dt><dd class:urgent-text={ends?.urgent}>{notStarted ? startsIn?.label.replace(" left", "") : ends?.label.replace(" left", "")}</dd></div>
              <div><dt>Timezone</dt><dd>{g.current.timezone}</dd></div>
            </dl>
            {#if g.details.status === "closed" && g.details.winner_attempt_id}
              {@const winner = g.details.standings.find(s => s.attempt_id === g.details!.winner_attempt_id)}
              <p class="badge badge-gold" role="status"><Icon name="trophy" />{winner?.username === me ? "You won this week! 5 challenge tokens awarded." : `${winner?.username ?? "A member"} caught the thief first.`}</p>
            {/if}
            {#if g.details.status === "cancelled"}<p class="move-warning" role="status"><Icon name="alert" />This challenge was cancelled by a group admin.</p>{/if}
            {#if open && !g.attempt && !notStarted}
              <button class="btn btn-primary btn-lg" type="button" disabled={app.busy || app.jailedUntil !== null} onclick={() => g.join()}>Join the challenge <Icon name="arrow" /></button>
              {#if app.jailedUntil}<p class="move-warning" role="status"><Icon name="lock" />You are suspended until {formatWhen(app.jailedUntil)}. You cannot join challenges until then.</p>{/if}
            {:else if open && notStarted}
              <p class="muted">The challenge hasn't opened yet. Come back on Monday at 07:00.</p>
            {/if}
            {#if canCancel && open}<button class="btn btn-ghost" type="button" onclick={() => (cancelling = true)}>Cancel this challenge</button>{/if}
          {:else}
            <p class="muted" role="status"><span class="spinner"></span> Loading the week…</p>
          {/if}
        </section>

        {#if g.attempt}<WeeklyPlay {app} />{/if}

        <section class="card rise" aria-labelledby="stand-title">
          <h2 id="stand-title">Standings</h2>
          <ol class="standings">
            {#each standings as s, i (s.username)}
              {@const st = weeklyStatus(s.status)}
              <li class:me={s.username === me}>
                <span class="rank">{i + 1}</span>
                <strong>{s.username}{s.username === me ? " (you)" : ""}</strong>
                {#if s.attempt_id && s.attempt_id === g.details?.winner_attempt_id}<Icon name="trophy" label="Winner" />{/if}
                <span class="badge badge-{st.tone === 'muted' ? '' : st.tone}">{st.label}</span>
              </li>
            {:else}<li class="muted">No one has joined yet.</li>{/each}
          </ol>
        </section>
      </section>

      <aside class="stack side-rail">
        <section class="card rise" aria-labelledby="timeline-title">
          <h2 id="timeline-title">Timeline</h2>
          <ol class="timeline">
            {#each g.events.slice(-12).reverse() as e (e.event_id)}
              <li><strong>{eventLabel(e.event_type)}</strong><small class="muted">{new Date(parseUtc(e.created_at)).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</small></li>
            {:else}<li class="muted">Nothing yet.</li>{/each}
          </ol>
        </section>

        <section class="card rise" aria-labelledby="notify-title">
          <h2 id="notify-title">Notifications</h2>
          <form class="form" onsubmit={(e) => { e.preventDefault(); void g.saveNotifications(web, email); }}>
            <label class="check"><input type="checkbox" bind:checked={web} /> In the app</label>
            <label class="check"><input type="checkbox" bind:checked={email} /> By email</label>
            <button class="btn" disabled={app.busy}>Save</button>
          </form>
          {#if g.notifications.length}
            <ul class="notices">{#each g.notifications.slice(0, 4) as n (n.notification_id)}<li class:unread={!n.read_at}>{notificationLabel(n.type)}</li>{/each}</ul>
          {/if}
        </section>

        <section class="card rise" aria-labelledby="hist-title">
          <h2 id="hist-title">Past weeks</h2>
          <ul class="notices">
            {#each g.history.slice(0, 6) as h (h.challenge_id)}<li><strong>{h.group_name}</strong> · {h.week} <span class="muted">({weeklyStatus(h.status).label})</span></li>{:else}<li class="muted">No finished weeks yet.</li>{/each}
          </ul>
        </section>
      </aside>
    </div>
  {/if}
</div>

{#if cancelling}
  <MoveDialog title="Cancel this week's challenge?" subtitle="Everyone's attempt closes. The reason is recorded in the audit log." onclose={() => (cancelling = false)}>
    <form class="form" onsubmit={async (e) => { e.preventDefault(); if (reason.trim().length >= 3 && await g.cancel(reason)) { cancelling = false; reason = ""; } }}>
      <label class="field"><span>Reason</span><input class="input" bind:value={reason} minlength="3" maxlength="200" required /></label>
      <div class="row-actions"><button class="btn btn-danger" disabled={app.busy || reason.trim().length < 3}>Cancel challenge</button><button class="btn btn-ghost" type="button" onclick={() => (cancelling = false)}>Keep it</button></div>
    </form>
  </MoveDialog>
{/if}
