<script lang="ts">
  import { onMount } from "svelte";
  import { api, ApiError } from "./api.ts";
  import { bytes, count, utc, duration, usedPercent, chartPoints } from "./format.mjs";
  import type { Overview, Period, Registrations, RegistrationStatus, Session, SystemInfo } from "./types.ts";
  import Icon from "./Icon.svelte";
  import Staff from "./Staff.svelte";
  import Operations from "./Operations.svelte";
  import { can, navigationFor, type Tab } from "./access.ts";

  type Resource<T> = { data: T | null; loading: boolean; error: string | null };
  let session = $state<Session | null>(null);
  let checkingSession = $state(true);
  let loginBusy = $state(false);
  let loginError = $state<string | null>(null);
  let username = $state("");
  let password = $state("");
  let tab = $state<Tab>("overview");
  let days = $state<Period>(30);
  let status = $state<RegistrationStatus>("abandoned");
  let page = $state(1);
  let autoRefresh = $state(true);
  let signoutBusy = $state(false);
  let actionError = $state<string | null>(null);
  let overview = $state<Resource<Overview>>({ data: null, loading: false, error: null });
  let registrations = $state<Resource<Registrations>>({ data: null, loading: false, error: null });
  let system = $state<Resource<SystemInfo>>({ data: null, loading: false, error: null });
  let refreshKey = $state(0);
  const navigation = $derived(navigationFor(session));
  $effect(() => { if (session && !navigation.some(item => item.id === tab)) tab = "overview"; });
  let epoch = 0;
  let overviewRequest = 0;
  let registrationsRequest = 0;
  let systemRequest = 0;

  const titles: Record<Tab, { eyebrow: string; title: string; description: string }> = {
    overview: { eyebrow: "YOUR APP, AT A GLANCE", title: "Operations overview", description: "Understand your audience, registration journey, and service health." },
    registrations: { eyebrow: "THE REGISTRATION JOURNEY", title: "Registration activity", description: "Review recorded registration attempts and where people left off." },
    staff: { eyebrow: "STAFF ACCESS", title: "Staff accounts", description: "Manage named administrators and their permissions." },
    audit: { eyebrow: "ACCOUNTABILITY", title: "Audit history", description: "See who accessed sensitive data and performed administrative actions." },
    accounts: { eyebrow: "ACCOUNT SUPPORT", title: "Account support", description: "Find accounts, investigate issues and perform recorded support actions." },
    analytics: { eyebrow: "PRODUCT HEALTH", title: "Activation and retention", description: "Track activity, case completion and retained user cohorts." },
    alerts: { eyebrow: "OPERATIONAL ATTENTION", title: "Alerts", description: "API errors, email delivery, background jobs and backup freshness." },
    moderation: { eyebrow: "TRUST AND SAFETY", title: "Moderation queue", description: "Review abuse reports and record moderation decisions." },
    system: { eyebrow: "KEEP THINGS RUNNING", title: "System health", description: "Host resources, service checks, and the delivery queue." }
  };
  const series = [
    { key: "visitors", label: "Visitors · opted in", color: "#108779" },
    { key: "registration_starts", label: "Starts · opted in", color: "#d69a27" },
    { key: "accounts_created", label: "Accounts created · all", color: "#4f6fae" },
    { key: "registrations_completed", label: "Email verified · all", color: "#7b569b" }
  ] as const;
  const metrics = $derived(overview.data?.available ? overview.data.metrics : null);
  const refreshing = $derived(overview.loading || registrations.loading || system.loading);
  const daily = $derived(overview.data?.available ? overview.data.daily : []);
  const chartMax = $derived(Math.max(1, ...daily.flatMap(point => series.map(item => point[item.key]))));
  const cards = $derived([
    { label: "Registered users", value: metrics?.registered_users, note: "All accounts · lifetime", icon: "users", accent: "teal" },
    { label: "Online now", value: metrics?.online_users, note: "Opted-in accounts · active within 5 min", icon: "health", accent: "green" },
    { label: "Unique visitors", value: metrics?.visitors, note: `Opted-in browsers · last ${days} days`, icon: "arrow", accent: "blue" },
    { label: "Registration starts", value: metrics?.registration_starts, note: `Opted-in browsers · last ${days} days`, icon: "users", accent: "amber" },
    { label: "Accounts created", value: metrics?.accounts_created, note: `All accounts · last ${days} days`, icon: "check", accent: "blue" },
    { label: "Registrations completed", value: metrics?.registrations_completed, note: `Email verified · last ${days} days`, icon: "check", accent: "violet" }
  ]);
  const host = $derived(system.data?.host);
  const resourceCards = $derived([
    { label: "Memory", percent: usedPercent(host?.memory_total_bytes, host?.memory_available_bytes), total: host?.memory_total_bytes, available: host?.memory_available_bytes, note: "RAM available to this host" },
    { label: "Disk", percent: usedPercent(host?.disk_total_bytes, host?.disk_available_bytes), total: host?.disk_total_bytes, available: host?.disk_available_bytes, note: host?.disk_path ?? "Monitored filesystem" },
    { label: "Swap", percent: usedPercent(host?.swap_total_bytes, host?.swap_free_bytes), total: host?.swap_total_bytes, available: host?.swap_free_bytes, note: host?.swap_total_bytes === 0 ? "No swap configured" : "Swap space available" }
  ]);

  function errorMessage(error: unknown) { return error instanceof Error ? error.message : "The request failed. Please try again."; }
  function expired(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      epoch += 1;
      session = null;
      overview = { data: null, loading: false, error: null };
      registrations = { data: null, loading: false, error: null };
      system = { data: null, loading: false, error: null };
      loginError = "Your admin session has expired. Sign in again to continue.";
      return true;
    }
    return false;
  }

  async function loadOverview() {
    const id = ++overviewRequest; const startedEpoch = epoch;
    overview.loading = true;
    try {
      const data = await api.overview(days);
      if (id === overviewRequest && epoch === startedEpoch) { overview.data = data; overview.error = null; }
    } catch (error) { if (epoch === startedEpoch && !expired(error) && id === overviewRequest) overview.error = errorMessage(error); }
    finally { if (id === overviewRequest && epoch === startedEpoch) overview.loading = false; }
  }
  async function loadRegistrations() {
    if (!can(session, "registrations:read")) return;
    const id = ++registrationsRequest; const startedEpoch = epoch;
    registrations.loading = true;
    try {
      const data = await api.registrations(days, status, page);
      if (id === registrationsRequest && epoch === startedEpoch) { registrations.data = data; registrations.error = null; }
    } catch (error) { if (epoch === startedEpoch && !expired(error) && id === registrationsRequest) registrations.error = errorMessage(error); }
    finally { if (id === registrationsRequest && epoch === startedEpoch) registrations.loading = false; }
  }
  async function loadSystem() {
    const id = ++systemRequest; const startedEpoch = epoch;
    system.loading = true;
    try {
      const data = await api.system();
      if (id === systemRequest && epoch === startedEpoch) { system.data = data; system.error = null; }
    } catch (error) { if (epoch === startedEpoch && !expired(error) && id === systemRequest) system.error = errorMessage(error); }
    finally { if (id === systemRequest && epoch === startedEpoch) system.loading = false; }
  }
  function sessionExpired() {
    expired(new ApiError("Your admin session has expired or was revoked.", 401));
  }
  function bootstrapRetired(namedUsername: string) {
    sessionExpired(); username = namedUsername;
    loginError = "Your named owner was created. The default admin is now permanently retired. Sign in with the new account.";
  }
  async function reloadSession() {
    const startedEpoch = epoch;
    try { const value = await api.session(); if (startedEpoch === epoch) session = value; }
    catch (error) { if (startedEpoch === epoch && !expired(error)) throw error; }
  }
  async function refresh() {
    if (!session) return;
    try { await reloadSession(); }
    catch (error) { actionError = errorMessage(error); return; }
    if (!session) return;
    refreshKey += 1;
    await Promise.allSettled([loadOverview(), loadRegistrations(), loadSystem()]);
  }
  async function signIn(event: SubmitEvent) {
    event.preventDefault();
    if (loginBusy) return;
    loginBusy = true; loginError = null;
    try { session = await api.login(username.trim(), password); epoch += 1; if (session.is_bootstrap) tab = "staff"; await refresh(); }
    catch (error) { loginError = errorMessage(error); }
    finally { password = ""; loginBusy = false; }
  }
  async function signOut() {
    signoutBusy = true; actionError = null;
    try {
      await api.logout(); epoch += 1; session = null;
      overview = { data: null, loading: false, error: null };
      registrations = { data: null, loading: false, error: null };
      system = { data: null, loading: false, error: null };
      loginError = null;
    } catch (error) { if (!expired(error)) actionError = errorMessage(error); }
    finally { signoutBusy = false; }
  }
  function changeDays(value: Period) {
    days = value; page = 1;
    overview.data = null; registrations.data = null;
    void Promise.allSettled([loadOverview(), loadRegistrations()]);
  }
  function changeStatus(value: RegistrationStatus) {
    status = value; page = 1; registrations.data = null; void loadRegistrations();
  }
  function changePage(value: number) { page = value; registrations.data = null; void loadRegistrations(); }
  function healthLabel(value: string | undefined) { return value === "healthy" ? "Healthy" : value === "not_configured" ? "Not configured" : "Unavailable"; }

  onMount(() => {
    void (async () => {
      try { session = await api.session(); await refresh(); }
      catch (error) { if (!(error instanceof ApiError && error.status === 401)) loginError = errorMessage(error); }
      finally { checkingSession = false; }
    })();
    const timer = setInterval(() => { if (session && autoRefresh && !document.hidden && !refreshing) void refresh(); }, 60_000);
    return () => clearInterval(timer);
  });
</script>

<svelte:head><title>{session ? `${titles[tab].title} · NaijaChase Admin` : "Sign in · NaijaChase Admin"}</title></svelte:head>

{#if checkingSession}
  <main class="session-loading" aria-live="polite"><div class="brand-mark">N<span>C</span></div><span class="spinner"></span><p>Checking your admin session…</p></main>
{:else if !session}
  <main class="login-layout">
    <section class="login-story" aria-label="NaijaChase administration">
      <a class="brand" href="/" aria-label="NaijaChase administration home"><span class="brand-mark">N<span>C</span></span><span>naijachase<span class="brand-sub">ADMINISTRATION</span></span></a>
      <div class="story-content"><div class="eyebrow light">BEHIND EVERY GREAT CHASE</div><h1>A clear view.<br />A healthier app.</h1><p>One place to understand the people, journeys, and systems that keep NaijaChase moving.</p><div class="story-rule"></div><div class="story-foot"><Icon name="lock" size={18} /> Restricted operator access</div></div>
      <div class="story-bottom">NaijaChase operations console</div>
    </section>
    <section class="login-main"><form class="login-form" onsubmit={signIn}>
      <span class="login-lock"><Icon name="lock" size={23} /></span><div class="eyebrow">WELCOME BACK</div><h2>Sign in to administration</h2><p>Use your dedicated admin credentials to continue.</p>
      {#if loginError}<div class="notice error" role="alert">{loginError}</div>{/if}
      <label for="username">Admin username</label><input id="username" name="username" autocomplete="username" required bind:value={username} disabled={loginBusy} />
      <label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required bind:value={password} disabled={loginBusy} />
      <button class="button primary login-submit" type="submit" disabled={loginBusy}>{#if loginBusy}<span class="spinner"></span>Signing in…{:else}Sign in securely <Icon name="arrow" size={18} />{/if}</button>
      <p class="login-note"><Icon name="lock" size={14} /> Your admin session uses a secure, separate cookie.</p>
    </form><div class="login-copyright">NaijaChase · Administration</div></section>
  </main>
{:else}
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <div class="app-layout">
    <aside class="sidebar">
      <a class="brand" href="/" onclick={(event) => { event.preventDefault(); tab = "overview"; }} aria-label="NaijaChase administration overview"><span class="brand-mark">N<span>C</span></span><span>naijachase<span class="brand-sub">ADMINISTRATION</span></span></a>
      <div class="sidebar-label">WORKSPACE</div>
      <nav aria-label="Administration">
        {#each navigation as item}
          <button class:active={tab === item.id} aria-current={tab === item.id ? "page" : undefined} onclick={() => tab = item.id as Tab}><Icon name={item.icon} /><span>{item.label}</span>{#if tab === item.id}<span class="nav-dot"></span>{/if}</button>
        {/each}
      </nav>
      <div class="sidebar-bottom"><div class="workspace-note"><span class="status-dot"></span>Operations workspace<span>Dedicated admin access</span></div><div class="operator"><span class="avatar">{session.username.slice(0, 1).toUpperCase()}</span><div><strong>{session.username}</strong><small>{session.is_bootstrap ? "Default admin · setup" : session.role}</small></div><button class="icon-button" aria-label="Sign out" title="Sign out" disabled={signoutBusy} onclick={signOut}><Icon name="logout" size={18} /></button></div></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="breadcrumb">Workspace <span>/</span> <strong>{titles[tab].title}</strong></div><span class="private-badge"><Icon name="lock" size={13} /> PRIVATE ADMIN</span><button class="mobile-signout" disabled={signoutBusy} onclick={signOut}><Icon name="logout" size={14} /> Sign out</button></header>
      <main class="main-content" id="main-content">
        <div class="page-heading"><div><div class="eyebrow">{titles[tab].eyebrow}</div><h1>{titles[tab].title}</h1><p>{titles[tab].description}</p></div><div class="heading-actions">
          {#if tab === "overview" || tab === "registrations"}<label class="sr-only" for="period">Reporting period</label><select id="period" value={days} onchange={(event) => changeDays(Number(event.currentTarget.value) as Period)}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select>{/if}
          <button class="button" aria-label={refreshing ? "Refreshing" : "Refresh current view"} onclick={() => void refresh()} disabled={refreshing}><Icon name="refresh" size={16} /><span>{refreshing ? "Refreshing…" : "Refresh"}</span></button>
        </div></div>
        {#if actionError}<div class="notice error" role="alert">{actionError}</div>{/if}
        {#if tab === "overview" || tab === "registrations" || tab === "system"}<div class="refresh-line"><span><Icon name="clock" size={13} /> {tab === "system" ? `Collected ${utc(system.data?.collected_at)}` : tab === "registrations" ? `Updated ${utc(registrations.data?.generated_at)}` : `Updated ${utc(overview.data?.generated_at)}`}</span><label class="refresh-toggle"><input type="checkbox" bind:checked={autoRefresh} /> Auto-refresh every minute</label></div>{/if}

        {#if session.is_bootstrap && tab !== "staff"}<div class="notice informational"><p>You are using the default admin. <button class="text-button" onclick={() => tab = "staff"}>Create your named owner</button> to finish setup and retire this account.</p></div>{/if}
        {#if tab === "staff" || tab === "audit"}
          <Staff section={tab} {session} {refreshKey} onunauthorized={sessionExpired} onretired={bootstrapRetired} onsessionchange={reloadSession} />
        {:else if tab === "accounts" || tab === "analytics" || tab === "alerts" || tab === "moderation"}
          <Operations section={tab} permissions={session.permissions} onunauthorized={sessionExpired} {refreshKey} />
        {:else if tab === "overview"}
          {#if overview.error}<div class="notice error" role="alert">{overview.error}{#if overview.data} <strong>Showing the last successful snapshot; these figures may be stale.</strong>{/if}</div>{/if}
          {#if overview.data && !overview.data.available}<div class="notice error" role="alert">Reporting is unavailable. {overview.data.unavailable_reason ?? "Try refreshing shortly."}</div>{/if}
          <section class="stats-grid" aria-label="Key statistics" aria-busy={overview.loading}>
            {#each cards as card}<article class="stat-card"><div class="stat-top"><span>{card.label}</span><span class="stat-icon {card.accent}"><Icon name={card.icon} size={18} /></span></div><div class="stat-number" class:unavailable={card.value == null}>{card.value == null && overview.loading ? "…" : count(card.value)}</div><p>{card.note}</p></article>{/each}
          </section>
          <div class="overview-panels"><section class="panel chart-panel"><div class="panel-heading"><div><h2>Daily activity</h2><p>A UTC day by day view of the registration journey</p></div><span class="subtle-tag">{days} DAYS · UTC</span></div>
            {#if overview.loading && !overview.data}<div class="empty-state"><span class="spinner"></span><p>Loading daily activity…</p></div>
            {:else if !overview.data?.available}<div class="empty-state"><Icon name="info" size={26} /><p>Daily reporting is unavailable.</p></div>
            {:else if !daily.length}<div class="empty-state"><Icon name="overview" size={26} /><p>No recorded activity in this period.</p></div>
            {:else}<div class="chart-legend">{#each series as item}<span><i style:background={item.color}></i>{item.label}</span>{/each}</div><div class="chart"><div class="chart-y"><span>{count(chartMax)}</span><span>{count(Math.round(chartMax / 2))}</span><span>0</span></div><div class="chart-plot"><svg viewBox="0 0 800 180" preserveAspectRatio="none" role="img" aria-label={`Daily visitors, registration starts, accounts created, and verified registrations for the last ${days} days. Exact values are in the data table below.`}><line x1="0" y1="1" x2="800" y2="1" class="grid-line" /><line x1="0" y1="90" x2="800" y2="90" class="grid-line" /><line x1="0" y1="179" x2="800" y2="179" class="grid-line" />{#each series as item}<polyline points={chartPoints(daily.map(point => point[item.key]), chartMax)} fill="none" stroke={item.color} stroke-width="2.5" vector-effect="non-scaling-stroke" />{/each}</svg><div class="chart-x"><span>{daily[0]?.date}</span><span>{daily[Math.floor(daily.length / 2)]?.date}</span><span>{daily[daily.length - 1]?.date}</span></div></div></div><details class="chart-data"><summary>View daily values</summary><div class="table-scroll"><table><thead><tr><th scope="col">Date (UTC)</th>{#each series as item}<th scope="col">{item.label}</th>{/each}</tr></thead><tbody>{#each daily as row}<tr><th scope="row">{row.date}</th>{#each series as item}<td>{count(row[item.key])}</td>{/each}</tr>{/each}</tbody></table></div></details>{/if}
            <div class="panel-footnote"><Icon name="info" size={15} /><p>Visitor IDs approximate browsers, not people. Visits and starts include only browsers that consented to analytics. Account and verification counts include all accounts; these series are not a conversion cohort.</p></div>
          </section>
          <section class="panel journey-panel"><div class="panel-heading"><div><h2>Registration follow-up</h2><p>Where attention may be useful</p></div><span class="stat-icon amber"><Icon name="mail" size={18} /></span></div><div class="journey-row"><span>Verified users<small>All accounts · lifetime</small></span><strong>{count(metrics?.verified_users)}</strong></div><div class="journey-row"><span>Awaiting verification<small>All current accounts</small></span><strong>{count(metrics?.pending_verification)}</strong></div><div class="journey-row"><span>Abandoned registrations<small>Unique known emails · last {days} days</small></span><strong class="amber-text">{count(metrics?.abandoned_registrations)}</strong></div><p class="quiet-note">An attempt is abandoned after 24 hours without draft activity and no matching verified account. Draft emails are retained for 30 days.</p>{#if can(session, "registrations:read")}<button class="button full" onclick={() => tab = "registrations"}>Review registrations <Icon name="arrow" size={16} /></button>{/if}</section></div>
          <div class="notice informational"><Icon name="info" size={18} /><p>{overview.data?.tracking_started_at ? `Earliest retained opt-in visitor activity: ${utc(overview.data.tracking_started_at)}.` : "Opt-in visitor tracking begins with this release; no historical visitor or registration-start data is backfilled."} Daily visitor records are retained for 90 days.</p></div>
          {#if system.error}<div class="notice error" role="alert">System health could not be refreshed. {system.error} The service pulse is stale or unavailable.</div>{/if}<section class="panel services-summary"><div><h2>Service pulse</h2><p>Latest checks from the admin host</p></div>{#each [{ label: "Database", value: system.data?.database.status }, { label: "Application API", value: system.data?.application_api.status }, { label: "Email queue", value: system.data?.email_queue.status }] as service}<div class="service-mini"><span>{service.label}</span><span class="health-badge" class:healthy={service.value === "healthy" && !system.error}><i></i>{system.error ? "Stale / unavailable" : healthLabel(service.value)}</span></div>{/each}<button class="text-button" onclick={() => tab = "system"}>View health <Icon name="arrow" size={15} /></button></section>

        {:else if tab === "registrations"}
          <div class="notice informational"><Icon name="info" size={18} /><p>Only attempts with a captured email appear here. Draft capture requires analytics consent; this list is not every person who visited registration. An abandoned attempt has no draft activity for 24 hours and no matching verified account. Draft email records expire after 30 days, including when a 90-day filter is selected.</p></div>
          {#if registrations.error}<div class="notice error" role="alert">{registrations.error}{#if registrations.data} <strong>Showing a previous snapshot; these records may be stale.</strong>{/if}</div>{/if}
          {#if registrations.data && !registrations.data.available}<div class="notice error" role="alert">Registration reporting is unavailable. {registrations.data.unavailable_reason ?? "Try refreshing shortly."}</div>{/if}
          <section class="panel registrations-panel" aria-busy={registrations.loading}><div class="panel-heading"><div><h2>Registration records <span class="count-badge">{registrations.data?.available ? count(registrations.data.total) : "—"}</span></h2><p>Latest activity first · one record per email · UTC</p></div><div><label class="sr-only" for="status">Registration status</label><select id="status" value={status} onchange={(event) => changeStatus(event.currentTarget.value as RegistrationStatus)}><option value="abandoned">Abandoned attempts</option><option value="pending">Pending attempts</option><option value="all">All recorded attempts</option></select></div></div>
            {#if registrations.loading && !registrations.data}<div class="empty-state"><span class="spinner"></span><p>Loading registration attempts…</p></div>
            {:else if !registrations.data?.available}<div class="empty-state"><Icon name="info" size={28} /><p>Registration records are unavailable.</p></div>
            {:else if !registrations.data.items.length}<div class="empty-state"><span class="empty-icon"><Icon name="check" size={26} /></span><h3>No matching attempts</h3><p>No recorded emails match this period and status.</p></div>
            {:else}<p class="table-hint">Scroll horizontally to view every column.</p><div class="table-scroll"><table><thead><tr><th scope="col">Email address</th><th scope="col">Status</th><th scope="col">Account</th><th scope="col">Started (UTC)</th><th scope="col">Last activity (UTC)</th></tr></thead><tbody>{#each registrations.data.items as row}<tr><td class="email-cell">{row.email}</td><td><span class="registration-badge {row.status}"><i></i>{row.status === "completed" ? "Completed" : row.status === "abandoned" ? "Abandoned" : "Pending"}</span></td><td>{row.email_verified ? "Email verified" : row.account_created ? "Created · unverified" : "Not created"}</td><td class="time-cell">{utc(row.started_at)}</td><td class="time-cell">{utc(row.updated_at)}</td></tr>{/each}</tbody></table></div>{/if}
            <div class="pagination"><span>{registrations.data?.available && registrations.data.total != null ? `${count(registrations.data.total)} matching emails · 25 per page` : "25 per page"}</span><div><button class="button small" disabled={page <= 1 || registrations.loading} onclick={() => changePage(page - 1)}>Previous</button><span>Page {page}</span><button class="button small" disabled={registrations.loading || !registrations.data?.available || registrations.data.total == null || page * 25 >= registrations.data.total} onclick={() => changePage(page + 1)}>Next</button></div></div>
          </section><p class="privacy-note"><Icon name="lock" size={14} /> Email addresses are restricted to authorized administrators. This view does not send follow-up messages.</p>

        {:else}
          {#if system.error}<div class="notice error" role="alert">{system.error}{#if system.data} <strong>Showing the last successful snapshot; health may have changed.</strong>{/if}</div>{/if}
          <div class="notice informational"><Icon name="server" size={18} /><p>Resource metrics describe the host running the admin backend{host?.hostname ? ` (${host.hostname})` : ""}. Deploy it beside the app to observe the same server. Containers and operating systems may limit available metrics.</p></div>
          {#if system.loading && !system.data}<div class="panel empty-state"><span class="spinner"></span><p>Collecting system health…</p></div>{:else}
          <section class="resource-grid" aria-label="Host resource usage">{#each resourceCards as card}<article class="panel resource-card"><div class="panel-heading"><h2>{card.label}</h2><span class="subtle-tag">{card.percent == null ? (card.total === 0 ? "NOT CONFIGURED" : "UNAVAILABLE") : `${Math.round(card.percent)}% USED`}</span></div><div class="resource-value">{bytes(card.available)}<small>{card.available == null ? `${bytes(card.total)} total · available measurement missing` : `available of ${bytes(card.total)}`}</small></div>{#if card.percent != null}<div class="meter" role="meter" aria-label={`${card.label} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={card.percent} aria-valuetext={`${Math.round(card.percent)} percent used`}><span class:high={card.percent >= 85} style:width={`${card.percent}%`}></span></div>{:else}<div class="meter" aria-hidden="true"></div>{/if}<p>{card.note}</p></article>{/each}</section>
          <div class="system-panels"><section class="panel"><div class="panel-heading"><div><h2>Host information</h2><p>A snapshot of the admin server</p></div><span class="stat-icon blue"><Icon name="server" size={18} /></span></div><dl class="host-details"><div><dt>Hostname</dt><dd>{host?.hostname ?? "Unavailable"}</dd></div><div><dt>Uptime</dt><dd>{duration(host?.uptime_seconds)}</dd></div><div><dt>Logical CPUs</dt><dd>{count(host?.cpu_count)}</dd></div><div><dt>Load average <small>1 / 5 / 15 minutes</small></dt><dd>{host?.load_average?.map(value => value.toFixed(2)).join(" / ") ?? "Unavailable"}</dd></div><div><dt>Monitored disk</dt><dd>{host?.disk_path ?? "Unavailable"}</dd></div><div><dt>Sample time</dt><dd>{utc(system.data?.collected_at)}</dd></div></dl><p class="quiet-note load-note">Load average measures waiting and running work, not CPU usage percentage. Compare it with the number of logical CPUs.</p></section>
          <section class="panel"><div class="panel-heading"><div><h2>Connected services</h2><p>Checks made by the admin backend</p></div><span class="stat-icon teal"><Icon name="health" size={18} /></span></div>{#each [{ label: "Database", note: "Reporting database connection", value: system.data?.database.status }, { label: "Application API", note: "Configured application health endpoint", value: system.data?.application_api.status }, { label: "Email delivery queue", note: "Queue state from the application database", value: system.data?.email_queue.status }] as service}<div class="service-row"><span><strong>{service.label}</strong><small>{service.note}</small></span><span class="health-badge" class:healthy={service.value === "healthy"}><i></i>{healthLabel(service.value)}</span></div>{/each}<p class="quiet-note load-note">Healthy email queue reporting confirms database access. It does not confirm successful delivery to a recipient.</p></section></div>
          <section class="panel email-panel"><div class="panel-heading"><div><h2>Email delivery queue</h2><p>Current queue totals · all time</p></div><span class="subtle-tag">{healthLabel(system.data?.email_queue.status)}</span></div><div class="queue-grid">{#each [{ key: "queued", label: "Queued", note: "Waiting to send" }, { key: "sending", label: "Sending", note: "Currently in progress" }, { key: "failed", label: "Failed", note: "Review application mail logs" }, { key: "sent", label: "Sent", note: "Handed to the mail transport" }] as item}<div><span>{item.label}</span><strong class:amber-text={item.key === "failed" && !!system.data?.email_queue.failed}>{count(system.data?.email_queue[item.key as "queued" | "sending" | "failed" | "sent"])}</strong><small>{item.note}</small></div>{/each}</div></section>{/if}
        {/if}
        <footer class="page-footer"><span>NaijaChase administration</span><span>All reporting times use UTC · auto-refresh pauses in hidden tabs</span></footer>
      </main>
    </div>
  </div>
{/if}
