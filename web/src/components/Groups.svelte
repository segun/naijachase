<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import { GROUP_NAME_MAX, GROUP_ROLE_LABEL, canManageGroup, groupNameProblem, memberActions, myRole, usernameProblem, type GroupMember } from "../model.ts";
  import Icon from "./Icon.svelte";
  import MoveDialog from "./MoveDialog.svelte";

  let { app }: { app: AppController } = $props();
  const g = $derived(app.groups);
  const me = $derived(app.player?.username ?? "");
  const group = $derived(g.selected);
  const role = $derived(group ? myRole(group, me) : undefined);
  let name = $state(""), capacity = $state(20), invitee = $state("");
  let confirm = $state<null | { kind: "remove" | "transfer" | "leave" | "delete"; member?: GroupMember }>(null);

  $effect(() => { void g.load(); });
  const nameProblem = $derived(name ? groupNameProblem(name) : null);
  const inviteProblem = $derived(invitee ? usernameProblem(invitee) : null);

  async function create(event: SubmitEvent) {
    event.preventDefault();
    if (!groupNameProblem(name) && await g.create(name, capacity)) { name = ""; }
  }
  async function sendInvite(event: SubmitEvent) {
    event.preventDefault();
    if (!usernameProblem(invitee) && await g.invite(invitee)) invitee = "";
  }
  async function doConfirm() {
    const c = confirm; if (!c) return;
    const ok = c.kind === "remove" ? await g.remove(c.member!.player_id)
      : c.kind === "transfer" ? await g.transfer(c.member!.player_id)
      : c.kind === "leave" ? await g.leave() : await g.disband();
    if (ok) confirm = null;
  }
  const confirmText = $derived.by(() => {
    const c = confirm; if (!c) return { title: "", body: "", button: "" };
    return {
      remove: { title: `Remove ${c.member?.username}?`, body: "They will lose access to the group's challenges.", button: "Remove" },
      transfer: { title: `Make ${c.member?.username} the owner?`, body: "You will become an admin. This cannot be undone without their consent.", button: "Transfer ownership" },
      leave: { title: "Leave this group?", body: "You will stop seeing its weekly challenges.", button: "Leave group" },
      delete: { title: "Delete this group?", body: "The group is removed for every member. This cannot be undone.", button: "Delete group" }
    }[c.kind];
  });
</script>

<div class="page">
  <header class="page-head rise">
    <p class="eyebrow">Groups</p>
    <h1>Your investigation groups</h1>
    <p>Private groups for friends. Rosters and weekly challenges are visible to members only. There is no public directory.</p>
  </header>

  {#if g.invitations.length}
    <section class="card rise" aria-labelledby="inv-title">
      <h2 id="inv-title">Invitations</h2>
      <ul class="devices">
        {#each g.invitations as inv (inv.invitation_id)}
          <li>
            <span class="device-icon"><Icon name="mail" /></span>
            <div><strong>{inv.group_name}</strong><small class="muted">Invited you · expires {new Date(inv.expires_at).toLocaleDateString()}</small></div>
            <button class="btn btn-primary" type="button" disabled={app.busy} onclick={() => g.answer(inv, true)}>Join</button>
            <button class="btn btn-ghost" type="button" disabled={app.busy} onclick={() => g.answer(inv, false)}>Decline</button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <div class="split">
    <section class="stack" aria-label="Groups">
      {#if !g.loaded}
        <p class="muted" role="status"><span class="spinner"></span> Loading…</p>
      {:else if g.groups.length === 0}
        <section class="card empty rise"><Icon name="users" /><h2>No groups yet</h2><p class="muted">Create one, or accept an invitation. Groups you join appear here.</p></section>
      {:else}
        <div class="segmented" role="group" aria-label="Choose a group">
          {#each g.groups as x (x.group_id)}<button type="button" aria-pressed={x.group_id === g.selectedId} onclick={() => g.select(x.group_id)}>{x.name}</button>{/each}
        </div>
      {/if}

      {#if group}
        <section class="card rise" aria-labelledby="roster-title">
          <div class="row-between">
            <div><h2 id="roster-title">{group.name}</h2><p class="muted">{group.members.length} of {group.capacity} members · you are {role ? GROUP_ROLE_LABEL[role].toLowerCase() : "a member"}</p></div>
            <button class="btn btn-primary" type="button" onclick={() => app.go("weekly")}><Icon name="trophy" />Weekly challenge</button>
          </div>
          <ul class="devices roster">
            {#each group.members as member (member.player_id)}
              {@const actions = role ? memberActions(role, member.role, member.username === me) : []}
              <li>
                <span class="device-icon"><Icon name="user" /></span>
                <div><strong>{member.username}{member.username === me ? " (you)" : ""}</strong><small class="muted">{GROUP_ROLE_LABEL[member.role]}</small></div>
                <div class="row-actions">
                  {#each actions as a}
                    {#if a === "promote"}<button class="btn btn-ghost" type="button" disabled={app.busy} onclick={() => g.setRole(member.player_id, "admin")}>Make admin</button>
                    {:else if a === "demote"}<button class="btn btn-ghost" type="button" disabled={app.busy} onclick={() => g.setRole(member.player_id, "member")}>Make member</button>
                    {:else if a === "transfer"}<button class="btn btn-ghost" type="button" onclick={() => (confirm = { kind: "transfer", member })}>Make owner</button>
                    {:else}<button class="btn btn-ghost" type="button" onclick={() => (confirm = { kind: "remove", member })}>Remove</button>{/if}
                  {/each}
                </div>
              </li>
            {/each}
          </ul>
          {#if canManageGroup(role)}
            <form class="lookup" onsubmit={sendInvite}>
              <label class="field"><span>Invite by exact username</span><input class="input" bind:value={invitee} autocomplete="off" spellcheck="false" /></label>
              <button class="btn btn-primary" disabled={app.busy || !invitee.trim() || !!inviteProblem}>Send invitation</button>
            </form>
            {#if inviteProblem}<small class="hint warn">{inviteProblem}</small>{/if}
          {/if}
          <div class="row-actions">
            {#if role !== "owner"}<button class="btn btn-ghost" type="button" onclick={() => (confirm = { kind: "leave" })}>Leave group</button>{/if}
            {#if role === "owner"}<button class="btn btn-danger" type="button" onclick={() => (confirm = { kind: "delete" })}>Delete group</button>{/if}
          </div>
        </section>
      {/if}
    </section>

    <aside class="stack side-rail">
      <section class="card rise" aria-labelledby="new-group">
        <h2 id="new-group">Create a group</h2>
        <form class="form" onsubmit={create}>
          <label class="field"><span>Name</span><input class="input" bind:value={name} maxlength={GROUP_NAME_MAX} required /></label>
          {#if nameProblem}<small class="hint warn">{nameProblem}</small>{/if}
          <label class="field"><span>Capacity</span><input class="input" type="number" min="2" max="50" bind:value={capacity} /></label>
          <button class="btn btn-primary" disabled={app.busy || !name.trim() || !!nameProblem}>Create group</button>
        </form>
      </section>
    </aside>
  </div>
</div>

{#if confirm}
  <MoveDialog title={confirmText.title} subtitle={confirmText.body} onclose={() => (confirm = null)}>
    <div class="row-actions">
      <button class="btn btn-danger" type="button" disabled={app.busy} onclick={doConfirm}>{confirmText.button}</button>
      <button class="btn btn-ghost" type="button" onclick={() => (confirm = null)}>Cancel</button>
    </div>
  </MoveDialog>
{/if}
