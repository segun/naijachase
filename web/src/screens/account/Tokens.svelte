<script lang="ts">
  import "../../styles/account.css";
  import { untrack } from "svelte";
  import type { AppController } from "../../state/app.svelte";
  import { formatWhen, jailRemaining, MAX_TOKENS_HELD, offenceLabel, punishmentLabel, reasonLabel, tally } from "../../domain/pressure.ts";
  import Icon from "../../ui/Icon.svelte";

  let { app }: { app: AppController } = $props();
  $effect(() => { if (app.signedIn) untrack(() => { void app.loadTokenHistory(); }); });
</script>

<div class="page narrow">
  <header class="page-head rise">
    <p class="eyebrow">Career file</p>
    <h1>Bribe tokens</h1>
    <p>Your balance, token history and disciplinary record. They are private to you.</p>
  </header>

  <section class="card settings rise" aria-labelledby="tokens-title">
    <h2 id="tokens-title">Bribe tokens</h2>
    <p class="muted">Tokens are earned only by solving cases and can't be bought, gifted, traded or cashed out. Bribing a witness costs one; intimidation is free but riskier. You can hold up to {MAX_TOKENS_HELD}.</p>
    <p class="profile-fact"><Icon name="star" /><span>Current balance</span><strong>{app.tokenBalance ?? "…"}</strong></p>
    {#if app.jailedUntil}<p class="badge badge-red" role="status"><Icon name="lock" />Suspended until {formatWhen(app.jailedUntil)} ({jailRemaining(app.jailedUntil, new Date())})</p>{/if}
    <h3>Token history</h3>
    {#if !app.tokenLedgerLoaded}<p class="muted" role="status">Loading history…</p>
    {:else if app.tokenLedger.length === 0}<p class="muted">No tokens earned or spent yet.</p>
    {:else}
      <ol class="token-history">
        {#each app.tokenLedger as entry (entry.reference_id + entry.created_at)}
          <li>
            <div><strong>{reasonLabel(entry.reason)}</strong><small class="muted">{formatWhen(entry.created_at)}</small></div>
            <div class={entry.amount < 0 ? "loss" : "gain"}><b>{entry.amount > 0 ? "+" : ""}{entry.amount}</b><small class="muted">Balance {entry.balance_after}</small></div>
          </li>
        {/each}
      </ol>
    {/if}
    <h3>Disciplinary record</h3>
    {#if !app.disciplineLoaded}<p class="muted" role="status">Loading record…</p>
    {:else if app.discipline.length === 0}<p class="muted">No panel cases. Pressing witnesses is optional and risky; refusing never makes a case harder.</p>
    {:else}
      <ol class="token-history">
        {#each app.discipline as c (c.disciplinary_case_id)}
          {@const t = tally(c.votes)}
          <li>
            <div><strong>{offenceLabel(c.offence)}</strong><small class="muted">{c.decision === "punish" ? "Punished" : "Warning"} · {t.punish} to {t.warning} · {punishmentLabel(c.punishment)}{c.repeat_offender ? " · repeat offence" : ""}</small>
              {#if c.points_after !== c.points_before || c.old_rank !== c.new_rank}<small class="muted">{c.points_before.toLocaleString()} → {c.points_after.toLocaleString()} points{c.old_rank !== c.new_rank ? ` · ${c.old_rank} → ${c.new_rank}` : ""}</small>{/if}
              {#if c.jailed_until}<small class="muted">Suspended until {formatWhen(c.jailed_until)}</small>{/if}</div>
          </li>
        {/each}
      </ol>
    {/if}
  </section>

  <button class="btn btn-ghost" type="button" onclick={() => app.go("cases")}>Back to the case desk</button>
</div>
