<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { api, ApiError } from "./api.ts";
  import { utc } from "./format.mjs";
  import type { AuditList, Session, StaffAccount, StaffList, StaffRole } from "./types.ts";

  let { section, session, refreshKey = 0, onunauthorized, onretired, onsessionchange }: {
    section: "staff" | "audit"; session: Session; refreshKey?: number;
    onunauthorized: () => void; onretired: (username: string) => void; onsessionchange: () => Promise<void>;
  } = $props();
  let staff = $state<StaffList | null>(null), audit = $state<AuditList | null>(null);
  let loading = $state(false), busy = $state(false), error = $state(""), message = $state("");
  let username = $state(""), password = $state(""), confirm = $state(""), reason = $state(""), role = $state<StaffRole>("viewer");
  let editing = $state<StaffAccount | null>(null), editRole = $state<StaffRole>("viewer"), enabled = $state(true);
  let editPassword = $state(""), editConfirm = $state(""), editReason = $state("");
  let page = $state(1), sequence = 0;
  let disposed = false;
  onDestroy(() => { disposed = true; sequence++; });
  const bootstrap = $derived(session.is_bootstrap);
  const roles: { value: StaffRole; label: string; detail: string }[] = [
    { value: "owner", label: "Owner", detail: "Staff, audit history, support, moderation and reports" },
    { value: "operator", label: "Operator", detail: "Account support, registration emails, moderation and reports" },
    { value: "viewer", label: "Viewer", detail: "Aggregate reports, alerts and system health" },
  ];
  function failed(value: unknown) {
    if (disposed) return;
    if (value instanceof ApiError && value.status === 401) { onunauthorized(); return; }
    error = value instanceof Error ? value.message : "The request could not be completed.";
  }
  async function load() {
    const id = ++sequence; loading = true; error = "";
    try {
      if (section === "staff") { const value = await api.staff(); if (id === sequence) staff = value; }
      else { const value = await api.audit(page); if (id === sequence) audit = value; }
    } catch (value) { if (id === sequence) failed(value); }
    finally { if (id === sequence) loading = false; }
  }
  $effect(() => { section; refreshKey; void untrack(load); return () => { sequence++; }; });
  async function create(event: SubmitEvent) {
    event.preventDefault(); if (busy) return; error = ""; message = "";
    if (password !== confirm) { error = "Passwords do not match."; return; }
    busy = true;
    try {
      const account = await api.createStaff(username.trim(), password, bootstrap ? "owner" : role, reason.trim());
      if (disposed) return;
      username = ""; reason = "";
      if (bootstrap) { onretired(account.username); return; }
      message = `Created ${account.username}.`; await load();
    } catch (value) { failed(value); }
    finally { password = ""; confirm = ""; busy = false; }
  }
  function edit(account: StaffAccount) {
    editing = account; editRole = account.role; enabled = account.enabled; editPassword = ""; editConfirm = ""; editReason = ""; message = ""; error = "";
  }
  async function save(event: SubmitEvent) {
    event.preventDefault(); if (!editing || busy) return; error = ""; message = "";
    if (editPassword !== editConfirm) { error = "Passwords do not match."; return; }
    busy = true;
    try {
      await api.updateStaff(editing.account_id, { role: editRole, enabled, ...(editPassword ? { password: editPassword } : {}), reason: editReason.trim() });
      if (disposed) return;
      editing = null; message = "Staff account updated. Affected sessions are revoked.";
      await onsessionchange(); await load();
    } catch (value) { failed(value); }
    finally { editPassword = ""; editConfirm = ""; busy = false; }
  }
  function nextPage(value: number) { page = value; void load(); }
</script>

{#if error}<div class="notice error" role="alert">{error}{#if staff || audit} Previous data may be stale.{/if}</div>{/if}
{#if message}<div class="notice informational" role="status">{message}</div>{/if}
{#if loading && !staff && !audit}<div class="panel empty-state" role="status">Loading…</div>{/if}
{#if section === "staff"}
  {#if bootstrap}<div class="notice informational"><p><strong>Finish administrator setup.</strong> Create your first named owner below. The default admin will immediately stop working and its sessions will be signed out. It stays retired if accounts are later disabled.</p></div>{/if}
  <section class="panel staff-panel"><div class="panel-heading"><div><h2>Staff accounts</h2><p>{staff?.bootstrap_retired ? "Default admin permanently retired" : "Default admin available only for initial setup"}</p></div><button class="button small" disabled={loading || busy} onclick={() => void load()}>Refresh</button></div>
    {#if staff}<div class="table-scroll"><table><thead><tr><th scope="col">Username</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Created (UTC)</th><th scope="col">Manage</th></tr></thead><tbody>
      {#each staff.accounts as account}<tr><td>{account.username}{#if account.account_id === session.account_id} <small>(you)</small>{/if}{#if account.is_bootstrap} <small>Default</small>{/if}</td><td>{account.role}</td><td>{account.enabled ? "Active" : account.is_bootstrap ? "Retired" : "Disabled"}</td><td>{utc(account.created_at)}</td><td>{#if !account.is_bootstrap}<button class="button small" disabled={busy} onclick={() => edit(account)}>Edit account</button>{:else}Initial setup only{/if}</td></tr>{/each}
    </tbody></table></div>{:else if !loading}<p class="empty-state">Staff accounts are unavailable.</p>{/if}
  </section>
  <div class="staff-grid"><section class="panel staff-panel"><div class="panel-heading"><div><h2>{bootstrap ? "Create your named owner" : "Add staff account"}</h2><p>Share credentials with the intended staff member through your usual secure channel.</p></div></div>
    <form class="staff-form" onsubmit={create}>
      <label>Username<input autocomplete="off" required minlength="3" maxlength="64" bind:value={username} disabled={busy} /></label>
      {#if bootstrap}<label>Role<input value="Owner · first named account" disabled /></label>{:else}<label>Role<select bind:value={role} disabled={busy}>{#each roles as item}<option value={item.value}>{item.label}</option>{/each}</select></label>{/if}
      <label>Password<input type="password" autocomplete="new-password" required minlength="16" maxlength="128" bind:value={password} disabled={busy} /></label>
      <label>Confirm password<input type="password" autocomplete="new-password" required minlength="16" maxlength="128" bind:value={confirm} disabled={busy} /></label>
      <label class="wide">Reason<textarea required minlength="6" maxlength="500" bind:value={reason} disabled={busy} placeholder="Why this account is needed"></textarea></label>
      <p class="quiet-note wide">Use at least 16 characters. The final active owner cannot be disabled or demoted.</p>
      <button class="button primary wide" disabled={busy || password !== confirm}>{busy ? "Saving…" : bootstrap ? "Create owner and retire default admin" : "Create staff account"}</button>
    </form>
  </section>
  <section class="panel staff-panel"><h2>Role permissions</h2><dl class="role-details">{#each roles as item}<div><dt>{item.label}</dt><dd>{item.detail}</dd></div>{/each}</dl><p class="quiet-note">Password changes, role changes and disabling an account revoke that staff member’s active sessions. The server checks permissions on every request.</p></section></div>
  {#if editing}<section class="panel staff-panel"><div class="panel-heading"><div><h2>Edit {editing.username}</h2><p>Changes are recorded in audit history.</p></div><button class="button small" disabled={busy} onclick={() => editing = null}>Cancel</button></div><form class="staff-form" onsubmit={save}>
    <label>Role<select bind:value={editRole} disabled={busy}>{#each roles as item}<option value={item.value}>{item.label}</option>{/each}</select></label>
    <label class="staff-checkbox"><input type="checkbox" bind:checked={enabled} disabled={busy} /> Account enabled</label>
    <label>New password (optional)<input type="password" autocomplete="new-password" minlength="16" maxlength="128" bind:value={editPassword} disabled={busy} /></label>
    <label>Confirm new password<input type="password" autocomplete="new-password" minlength="16" maxlength="128" bind:value={editConfirm} disabled={busy} /></label>
    <label class="wide">Reason<textarea required minlength="6" maxlength="500" bind:value={editReason} disabled={busy}></textarea></label>
    <button class="button primary wide" disabled={busy || editPassword !== editConfirm}>{busy ? "Saving…" : "Save changes"}</button>
  </form></section>{/if}
{:else if audit}
  <section class="panel staff-panel"><div class="panel-heading"><div><h2>Audit history</h2><p>{audit.total} events · times in UTC · passwords and session tokens are never recorded</p></div><button class="button small" disabled={loading} onclick={() => void load()}>Refresh</button></div>
    {#if audit.entries.length}<div class="table-scroll"><table><thead><tr><th scope="col">When</th><th scope="col">Staff member</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">Outcome</th><th scope="col">Reason</th></tr></thead><tbody>{#each audit.entries as entry}<tr><td>{utc(entry.created_at)}</td><td>{entry.actor_username}</td><td>{entry.action}</td><td class="audit-target">{entry.target}</td><td>{entry.outcome}</td><td class="audit-reason">{entry.reason || "—"}</td></tr>{/each}</tbody></table></div>{:else}<p class="empty-state">No audit events yet.</p>{/if}
    <div class="pagination"><span>25 events per page</span><div><button class="button small" disabled={page <= 1 || loading} onclick={() => nextPage(page - 1)}>Previous</button><span>Page {page}</span><button class="button small" disabled={loading || page * 25 >= audit.total} onclick={() => nextPage(page + 1)}>Next</button></div></div>
  </section>
{/if}

<style>
  .staff-panel { padding: 1.4rem; margin-bottom: 1.3rem; min-width: 0; }
  .staff-grid { display: grid; grid-template-columns: 1.35fr 1fr; gap: 1.3rem; }
  .staff-form { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .staff-form label { display: flex; flex-direction: column; gap: .4rem; font-weight: 600; font-size: .85rem; min-width: 0; }
  .staff-form input,.staff-form select,.staff-form textarea { width: 100%; min-width: 0; box-sizing: border-box; border: 1px solid #d7e1e4; border-radius: .5rem; padding: .7rem; background: #fff; color: #20353a; font: inherit; }
  .staff-form textarea { resize: vertical; min-height: 5rem; }
  .staff-form .wide { grid-column: 1 / -1; }
  .staff-form .staff-checkbox { flex-direction: row; align-items: center; } .staff-checkbox input { width: auto; }
  .role-details div { padding: .7rem 0; border-bottom: 1px solid #e7edef; } .role-details dt { font-weight: 700; } .role-details dd { margin: .35rem 0 0; color: #68777d; line-height: 1.5; }
  .audit-target,.audit-reason { max-width: 22rem; overflow-wrap: anywhere; white-space: normal; }
  @media(max-width: 850px) { .staff-grid { grid-template-columns: 1fr; } }
  @media(max-width: 540px) { .staff-form { grid-template-columns: 1fr; } .staff-panel { padding: 1rem; } }
</style>
