<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { ApiError } from "./api.ts";
  import { operations, type AccountDetail, type Account, type Alerts, type Analytics, type Page, type Report } from "./operations-api.ts";
  import { count, percentage, utc } from "./format.mjs";

  type Section = "accounts" | "analytics" | "alerts" | "moderation";
  let { section, permissions, refreshKey = 0, onunauthorized }: { section: Section; permissions: string[]; refreshKey?: number; onunauthorized: () => void } = $props();
  let loading = $state(false), detailLoading = $state(false), busy = $state(false), error = $state(""), message = $state("");
  let accounts = $state<Page<Account> | null>(null), analytics = $state<Analytics | null>(null), alerts = $state<Alerts | null>(null), moderation = $state<Page<Report> | null>(null);
  let search = $state(""), appliedSearch = $state(""), page = $state(1), days = $state(30), status = $state("open");
  let detail = $state<AccountDetail | null>(null), selectedId = $state(""), reason = $state(""), revokeConfirmed = $state(false);
  let selectedReport = $state<Report | null>(null), decision = $state("resolved"), moderationReason = $state("");
  let sequence = 0, detailSequence = 0, currentSection: Section | null = null, disposed = false;
  onDestroy(() => { disposed = true; sequence++; detailSequence++; });
  const canSupport = $derived(permissions.includes("accounts:support"));
  const canModerate = $derived(permissions.includes("moderation:resolve"));
  const readPermission: Record<Section, string> = { accounts: "accounts:read", analytics: "analytics:read", alerts: "alerts:read", moderation: "moderation:read" };
  const hasData = $derived(section === "accounts" ? !!accounts : section === "analytics" ? !!analytics : section === "alerts" ? !!alerts : !!moderation);
  function failed(value: unknown) {
    if (disposed) return;
    if (value instanceof ApiError && value.status === 401) { onunauthorized(); return; }
    error = value instanceof Error ? value.message : "The request could not be completed.";
  }
  async function load() {
    if (disposed) return;
    if (!permissions.includes(readPermission[section])) { error = "Your role does not allow this screen."; return; }
    const id = ++sequence, view = section; loading = true; error = "";
    try {
      if (view === "accounts") { const value = await operations.accounts(appliedSearch, page); if (id === sequence) accounts = value; }
      else if (view === "analytics") { const value = await operations.analytics(days); if (id === sequence) analytics = value; }
      else if (view === "alerts") { const value = await operations.alerts(); if (id === sequence) alerts = value; }
      else { const value = await operations.moderation(status, page); if (id === sequence) moderation = value; }
    } catch (value) { if (id === sequence) failed(value); }
    finally { if (id === sequence) loading = false; }
  }
  $effect(() => {
    const view = section; refreshKey;
    untrack(() => {
      if (currentSection !== view) { page = 1; error = ""; message = ""; selectedId = ""; detail = null; detailLoading = false; selectedReport = null; reason = ""; moderationReason = ""; currentSection = view; detailSequence++; }
      void load();
    });
    const timer = view === "alerts" ? setInterval(() => { if (!document.hidden && !loading) void load(); }, 30_000) : undefined;
    return () => { sequence++; if (timer) clearInterval(timer); };
  });
  async function showAccount(id: string) {
    if (disposed) return;
    const request = ++detailSequence; selectedId = id; detail = null; detailLoading = true; reason = ""; revokeConfirmed = false; error = ""; message = "";
    try { const value = await operations.account(id); if (request === detailSequence) detail = value; }
    catch (value) { if (request === detailSequence) failed(value); }
    finally { if (request === detailSequence) detailLoading = false; }
  }
  function searchAccounts(event: SubmitEvent) { event.preventDefault(); appliedSearch = search.trim(); page = 1; void load(); }
  function changePage(value: number) { page = value; void load(); }
  async function support(action: "note" | "revoke") {
    if (disposed || !detail || busy || !canSupport) return;
    if (!reason.trim() || reason.trim().length > 500) { error = "Enter a reason of 1–500 characters."; return; }
    if (action === "revoke" && !revokeConfirmed) { error = "Review the selected account and confirm the sign-out action."; return; }
    const id = detail.account.player_id, view = section; busy = true; error = ""; message = "";
    try {
      const result = action === "note" ? await operations.note(id, reason.trim()) : await operations.revoke(id, reason.trim());
      if (!disposed && section === view && selectedId === id) { await showAccount(id); message = "message" in result ? result.message : "Support note saved."; }
    } catch (value) { if (!disposed && section === view) failed(value); }
    finally { if (!disposed) busy = false; }
  }
  function review(report: Report) { selectedReport = report; decision = "resolved"; moderationReason = ""; error = ""; message = ""; }
  async function resolve(event: SubmitEvent) {
    event.preventDefault(); if (disposed || !selectedReport || busy || !canModerate) return;
    if (!moderationReason.trim() || moderationReason.trim().length > 500) { error = "Enter a reason of 1–500 characters."; return; }
    const id = selectedReport.report_id, view = section; busy = true; error = ""; message = "";
    try { await operations.resolve(id, decision, moderationReason.trim()); if (!disposed && section === view) { selectedReport = null; moderationReason = ""; message = "Moderation decision saved in audit history."; await load(); } }
    catch (value) { if (!disposed && section === view) failed(value); }
    finally { if (!disposed) busy = false; }
  }
  function retention(returned: number, eligible: number) { return eligible ? `${percentage(returned, eligible)} · ${count(returned)} / ${count(eligible)}` : "Not eligible yet"; }
  function severity(value: string) { return value === "not_configured" ? "Not configured" : value.charAt(0).toUpperCase() + value.slice(1); }
</script>

{#if error}<div class="notice error" role="alert">{error}{#if hasData} Previous data may be stale. Refresh before taking action.{/if}</div>{/if}
{#if message}<div class="notice informational" role="status">{message}</div>{/if}
{#if loading && !hasData}<div class="panel empty-state" role="status">Loading…</div>{/if}
{#if !permissions.includes(readPermission[section])}<p class="panel empty-state">Your role does not allow this screen.</p>
{:else if section === "accounts"}
  <section class="panel operations-panel">
    <div class="panel-heading"><div><h2>Account lookup</h2><p>Search an email, username, name prefix or exact player ID. Access is audited.</p></div><button class="button small" disabled={loading || busy} onclick={() => void load()}>Refresh</button></div>
    <form class="search-form" onsubmit={searchAccounts}><label for="account-search">Find an account<input id="account-search" type="search" maxlength="320" autocomplete="off" bind:value={search} placeholder="Email, username, name or player ID" disabled={busy} /></label><button class="button primary" disabled={loading || busy}>Search</button></form>
    {#if accounts}<div class="table-scroll"><table><thead><tr><th scope="col">Account</th><th scope="col">Registration</th><th scope="col">Last seen (UTC)</th><th scope="col">Cases completed</th><th scope="col">Support</th></tr></thead><tbody>
      {#each accounts.items as account}<tr><td class="account-cell"><strong>{account.display_name}</strong><span>{account.email}</span><small>{account.username || account.player_id}</small></td><td>{account.email_verified_at ? "Verified" : "Unverified"}</td><td>{utc(account.last_seen_at)}</td><td>{count(account.completed_cases)}</td><td><button class="button small" disabled={busy} onclick={() => void showAccount(account.player_id)}>View account</button></td></tr>{/each}
    </tbody></table></div>{#if accounts.items.length === 0}<p class="empty-state">No matching accounts.</p>{/if}<div class="pagination"><span>{count(accounts.total)} matching accounts</span><div><button class="button small" disabled={loading || busy || page <= 1} onclick={() => changePage(page - 1)}>Previous</button><span>Page {page}</span><button class="button small" disabled={loading || busy || page * 25 >= accounts.total} onclick={() => changePage(page + 1)}>Next</button></div></div>{:else if !loading}<p class="empty-state">Account reporting is unavailable.</p>{/if}
  </section>
  {#if detailLoading}<div class="panel empty-state" role="status">Loading account details…</div>{/if}
  {#if detail}<section class="panel operations-panel" aria-label="Selected account"><div class="panel-heading"><div><h2>{detail.account.display_name}</h2><p>{detail.account.email} · {detail.account.player_id}</p></div><button class="button small" disabled={busy || detailLoading} onclick={() => void showAccount(detail!.account.player_id)}>Refresh account</button></div>
    <dl class="detail-grid"><div><dt>Registered</dt><dd>{utc(detail.account.created_at)}</dd></div><div><dt>Email verified</dt><dd>{utc(detail.account.email_verified_at)}</dd></div><div><dt>Last seen</dt><dd>{utc(detail.account.last_seen_at)}</dd></div><div><dt>Active sessions</dt><dd>{count(detail.account.active_sessions)}</dd></div><div><dt>Points</dt><dd>{count(detail.account.points)}</dd></div><div><dt>Cases solved / completed</dt><dd>{count(detail.account.solved_cases)} / {count(detail.account.completed_cases)}</dd></div></dl>
    {#if canSupport}<div class="support-actions"><h3>Controlled support actions</h3><p>Notes stay in the admin workspace. Signing out revokes the player’s live sessions; the player can sign in again.</p><label>Reason / support note<textarea maxlength="500" bind:value={reason} disabled={busy} placeholder="Explain the account issue and why this action is needed"></textarea></label><label class="check-label"><input type="checkbox" bind:checked={revokeConfirmed} disabled={busy} /> I reviewed {detail.account.email} and intend to sign this player out.</label><div class="action-row"><button class="button" disabled={busy || !reason.trim()} onclick={() => void support("note")}>Save support note</button><button class="button danger" disabled={busy || !reason.trim() || !revokeConfirmed} onclick={() => void support("revoke")}>{busy ? "Saving…" : "Sign out all player sessions"}</button></div></div>{/if}
    <details open><summary>Support notes ({detail.notes.length}, latest 50)</summary>{#if detail.notes.length}<ul class="record-list">{#each detail.notes as note}<li><p>{note.reason}</p><small>{note.staff} · {utc(note.created_at)}</small></li>{/each}</ul>{:else}<p class="section-note">No support notes.</p>{/if}</details>
    <details><summary>Support actions (latest 25)</summary>{#if detail.support_actions.length}<ul class="record-list">{#each detail.support_actions as action}<li><p><strong>{action.action}: {action.status}</strong> · {action.reason}</p><small>{utc(action.completed_at)}{#if action.status === "pending" || action.status === "unknown"} · Verify current sessions before retrying.{/if}</small></li>{/each}</ul>{:else}<p class="section-note">No recorded support actions.</p>{/if}</details>
    <details><summary>Case history (latest 25)</summary><div class="table-scroll"><table><thead><tr><th scope="col">Case</th><th scope="col">Type</th><th scope="col">Completed (UTC)</th><th scope="col">Outcome</th></tr></thead><tbody>{#each detail.cases as item}<tr><td>{item.mission_id || item.case_id}</td><td>{item.attempt_kind}</td><td>{utc(item.completed_at)}</td><td>{item.outcome || "In progress"}</td></tr>{/each}</tbody></table></div>{#if !detail.cases.length}<p class="section-note">No case history.</p>{/if}</details>
    <details><summary>Security events (latest 25)</summary><ul class="record-list">{#each detail.security_events as event}<li>{event.event_type} · {event.outcome}<small>{utc(event.created_at)}</small></li>{/each}</ul>{#if !detail.security_events.length}<p class="section-note">No retained security events.</p>{/if}</details>
  </section>{/if}
{:else if section === "analytics"}
  <div class="operations-toolbar"><label>Registration / case period<select bind:value={days} onchange={() => void load()} disabled={loading}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label><button class="button small" disabled={loading} onclick={() => void load()}>Refresh</button></div>
  {#if analytics}<p class="refresh-line">Collected {utc(analytics.generated_at)} · calendar dates in UTC</p><section class="panel operations-panel"><div class="panel-heading"><div><h2>Activation</h2><p>{analytics.definitions.activation}</p></div></div><div class="metric-grid">{#each [{ label: "Accounts created", value: analytics.activation.accounts_created }, { label: "Email verified", value: analytics.activation.email_verified }, { label: "Started a case", value: analytics.activation.started_case }, { label: "Completed a case", value: analytics.activation.completed_case }, { label: "Solved a case", value: analytics.activation.solved_case }] as metric}<div><span>{metric.label}</span><strong>{count(metric.value)}</strong></div>{/each}</div></section>
    <section class="panel operations-panel"><div class="panel-heading"><div><h2>Active accounts</h2><p>{analytics.activity.scope}</p></div></div><div class="metric-grid"><div><span>Today</span><strong>{count(analytics.activity.dau)}</strong></div><div><span>Last 7 days</span><strong>{count(analytics.activity.wau)}</strong></div><div><span>Last 30 days</span><strong>{count(analytics.activity.mau)}</strong></div></div><p class="section-note">Measurement coverage began {analytics.activity.coverage_started_at || "at an unavailable date"}. This excludes accounts that declined usage measurement.</p><details><summary>Daily activity</summary><div class="table-scroll"><table><thead><tr><th scope="col">Date (UTC)</th><th scope="col">Active accounts</th></tr></thead><tbody>{#each analytics.daily_activity as day}<tr><td>{day.date}</td><td>{count(day.accounts)}</td></tr>{/each}</tbody></table></div>{#if !analytics.daily_activity.length}<p class="section-note">No measured activity in this period.</p>{/if}</details></section>
    <section class="panel operations-panel"><div class="panel-heading"><div><h2>Case completion</h2><p>{analytics.definitions.case_outcomes} Starts count only cases with a recorded start date; older archive-only records may lack one.</p></div><span class="subtle-tag">{count(analytics.case_starts)} recorded case starts</span></div><div class="table-scroll"><table><thead><tr><th scope="col">Closing outcome</th><th scope="col">Cases</th></tr></thead><tbody>{#each analytics.case_outcomes as outcome}<tr><td>{outcome.outcome}</td><td>{count(outcome.count)}</td></tr>{/each}</tbody></table></div>{#if !analytics.case_outcomes.length}<p class="section-note">No case completions in this period.</p>{/if}</section>
    <section class="panel operations-panel"><div class="panel-heading"><div><h2>Registration cohorts and retention</h2><p>{analytics.definitions.retention}</p></div></div><p class="section-note">Each cell shows return rate and returned / eligible accounts. An empty denominator is not a zero return rate.</p><div class="table-scroll"><table><thead><tr><th scope="col">Signup date (UTC)</th><th scope="col">Measured cohort</th><th scope="col">Day 1 return</th><th scope="col">Day 7 return</th><th scope="col">Day 30 return</th></tr></thead><tbody>{#each analytics.retention as cohort}<tr><td>{cohort.date}</td><td>{count(cohort.cohort)}</td><td>{retention(cohort.day1_returned, cohort.day1_eligible)}</td><td>{retention(cohort.day7_returned, cohort.day7_eligible)}</td><td>{retention(cohort.day30_returned, cohort.day30_eligible)}</td></tr>{/each}</tbody></table></div>{#if !analytics.retention.length}<p class="section-note">No eligible measured cohorts yet.</p>{/if}</section>
  {:else if !loading}<p class="panel empty-state">Analytics are unavailable.</p>{/if}
{:else if section === "alerts"}
  <div class="operations-toolbar"><p>Live checks refresh every 30 seconds while this page is visible.</p><button class="button small" disabled={loading} onclick={() => void load()}>Refresh checks</button></div>
  {#if alerts}<p class="refresh-line">Last checked {utc(alerts.generated_at)}</p><div class="notice informational">{alerts.scope}</div><div class="alert-grid">{#each alerts.items as alert}<article class="panel alert-card {alert.severity}"><div class="alert-heading"><h2>{alert.title}</h2><span class="alert-severity {alert.severity}">{severity(alert.severity)}</span></div><p>{alert.message}</p></article>{/each}</div>{#if !alerts.items.length}<p class="panel empty-state">No health checks were returned. Health is unknown.</p>{/if}
  {:else if !loading}<p class="panel empty-state">Health checks are unavailable. System health is unknown.</p>{/if}
{:else if section === "moderation"}
  <section class="panel operations-panel"><div class="panel-heading"><div><h2>Abuse and moderation queue</h2><p>Review reports and keep decisions in audit history. Escalated reports stay open.</p></div><button class="button small" disabled={loading || busy} onclick={() => void load()}>Refresh</button></div><div class="operations-toolbar"><label>Queue<select bind:value={status} onchange={() => { page = 1; void load(); }} disabled={loading || busy}><option value="open">Open and escalated</option><option value="resolved">Resolved / dismissed</option><option value="all">All reports</option></select></label></div>
    {#if moderation}<ul class="moderation-list">{#each moderation.items as report}<li><div class="report-heading"><strong>{report.category}</strong><span class="subtle-tag">{report.status}</span></div><p><strong>{report.reporter_username || report.reporter_id}</strong> reported <strong>{report.reported_username || report.reported_id}</strong></p><p class="report-details">{report.details || "No further details supplied."}</p><small>{utc(report.created_at)} · {report.report_id}</small>{#if report.resolution}<p class="resolution-note">{report.resolution.decision} by {report.resolution.staff} · {report.resolution.reason} · {utc(report.resolution.updated_at)}</p>{/if}{#if canModerate && report.status !== "resolved"}<button class="button small" disabled={busy} onclick={() => review(report)}>Review report</button>{/if}</li>{/each}</ul>{#if !moderation.items.length}<p class="empty-state">No reports in this queue.</p>{/if}<div class="pagination"><span>{count(moderation.total)} reports</span><div><button class="button small" disabled={loading || busy || page <= 1} onclick={() => changePage(page - 1)}>Previous</button><span>Page {page}</span><button class="button small" disabled={loading || busy || page * 25 >= moderation.total} onclick={() => changePage(page + 1)}>Next</button></div></div>{:else if !loading}<p class="empty-state">Moderation reports are unavailable.</p>{/if}
  </section>
  {#if selectedReport && canModerate}<section class="panel operations-panel"><div class="panel-heading"><div><h2>Review {selectedReport.category}</h2><p>{selectedReport.report_id}</p></div><button class="button small" disabled={busy} onclick={() => selectedReport = null}>Cancel</button></div><form class="moderation-form" onsubmit={resolve}><label>Decision<select bind:value={decision} disabled={busy}><option value="resolved">Resolve</option><option value="dismissed">Dismiss</option><option value="escalated">Escalate for further review</option></select></label><label>Reason<textarea required maxlength="500" bind:value={moderationReason} disabled={busy} placeholder="Explain the evidence reviewed and this decision"></textarea></label><p class="section-note">This records the moderation decision. Account access is managed separately through support actions.</p><button class="button primary" disabled={busy || !moderationReason.trim()}>{busy ? "Saving…" : "Save moderation decision"}</button></form></section>{/if}
{/if}

<style>
  .operations-panel { margin-bottom: 1.4rem; }
  .operations-panel .panel-heading p { max-width: 65rem; line-height: 1.65; }
  .operations-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; font-size: .85rem; }
  .operations-panel > .operations-toolbar { padding: 0 1.5rem; }
  .operations-toolbar label,.search-form label,.support-actions > label,.moderation-form label { display: flex; flex-direction: column; gap: .4rem; font-weight: 600; font-size: .85rem; min-width: 0; }
  .operations-toolbar select { margin-top: .2rem; }
  .search-form { display: flex; align-items: end; gap: .7rem; padding: 0 1.5rem 1.5rem; }
  .search-form label { flex: 1; } .search-form input { width: 100%; }
  .account-cell { overflow-wrap: anywhere; min-width: 200px; } .account-cell strong,.account-cell span,.account-cell small { display: block; }
  .account-cell strong { color: #234451; } .account-cell small { margin-top: .2rem; color: #81949e; }
  .detail-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 1.3rem; margin: .5rem 1.5rem 1.5rem; }
  .detail-grid dt { font-size: .75rem; color: #73848d; } .detail-grid dd { margin: .35rem 0 0; overflow-wrap: anywhere; }
  .support-actions { padding: 1.5rem; border-top: 1px solid var(--border); background: #f8fbfb; }
  .support-actions h3 { margin-bottom: .5rem; } .support-actions > p { color: #6f858f; font-size: .85rem; margin-bottom: 1rem; }
  textarea { border: 1px solid #d9e3e7; border-radius: 7px; min-height: 6rem; padding: .8rem; width: 100%; max-width: 100%; resize: vertical; font: inherit; color: #173340; }
  textarea:focus-visible { outline: 3px solid #25a99c; outline-offset: 3px; }
  .support-actions > .check-label { flex-direction: row; align-items: start; font-weight: 400; margin: 1rem 0; }
  .check-label input { flex-shrink: 0; margin-top: .3rem; }
  .action-row { display: flex; flex-wrap: wrap; gap: .7rem; } .danger { border-color: #d4a69b; color: #9c4935; }
  details { padding: 1rem 1.5rem; border-top: 1px solid var(--border); } summary { cursor: pointer; font-size: .9rem; font-weight: 600; }
  details .table-scroll { margin-top: 1rem; } details table { min-width: 480px; }
  .record-list { list-style: none; padding: 0; margin: .8rem 0 0; } .record-list li { padding: .8rem 0; border-bottom: 1px solid var(--border); overflow-wrap: anywhere; }
  .record-list li:last-child { border: 0; } .record-list small { display: block; color: #7a909a; margin-top: .3rem; }
  .section-note { color: #738892; font-size: .8rem; line-height: 1.75; padding: 1rem 1.5rem; } details .section-note,.moderation-form .section-note { padding: .7rem 0; }
  .metric-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(140px,1fr)); gap: 1rem; padding: .3rem 1.5rem 1.5rem; }
  .metric-grid > div { padding: 1rem; border-radius: .5rem; background: #f4f8f8; min-width: 0; } .metric-grid span { display: block; color: #708792; font-size: .8rem; } .metric-grid strong { font-size: 1.8rem; color: #244853; }
  .alert-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1.2rem; }
  .alert-card { padding: 1.4rem; border-left: 4px solid #a9b5bc; } .alert-card.healthy { border-left-color: #4d9d7a; } .alert-card.warning { border-left-color: #d1a448; } .alert-card.critical { border-left-color: #cb725b; }
  .alert-heading { display: flex; align-items: start; justify-content: space-between; gap: .8rem; margin-bottom: .8rem; } .alert-card p { font-size: .85rem; color: #71858f; line-height: 1.8; }
  .alert-severity { font-size: .7rem; padding: .2rem .5rem; border-radius: .3rem; white-space: nowrap; background: #edf0f3; color: #687c87; }
  .alert-severity.healthy { color: #397a57; background: #edf7f0; } .alert-severity.warning { color: #976c20; background: #fcf4e3; } .alert-severity.critical { color: #9c4935; background: #fff1eb; }
  .moderation-list { list-style: none; padding: 0; margin: 0; } .moderation-list > li { border-top: 1px solid var(--border); padding: 1.3rem 1.5rem; overflow-wrap: anywhere; }
  .report-heading { display: flex; justify-content: space-between; gap: .8rem; margin-bottom: .7rem; } .moderation-list p { font-size: .85rem; margin-bottom: .7rem; }
  .report-details { white-space: pre-wrap; } .moderation-list small { display: block; color: #83949d; font-size: .75rem; } .moderation-list button { margin-top: .8rem; }
  .resolution-note { margin-top: .8rem; padding: .8rem; border-radius: .5rem; background: #f3f7f7; color: #6d828a; }
  .moderation-form { padding: 0 1.5rem 1.5rem; display: grid; gap: 1rem; }
  @media(max-width: 850px) { .alert-grid { grid-template-columns: 1fr; } .detail-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
  @media(max-width: 550px) { .search-form { flex-direction: column; align-items: stretch; } .detail-grid { grid-template-columns: 1fr; } .alert-heading { flex-wrap: wrap; } .action-row { flex-direction: column; } .operations-panel .panel-heading { flex-wrap: wrap; } .pagination { flex-wrap: wrap; } }
</style>
