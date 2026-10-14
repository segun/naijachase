<script lang="ts">
  import type { AppController } from "../../state/app.svelte";
  import { HOME_BASES } from "../../domain/model.ts";
  import Brand from "../../ui/Brand.svelte";
  import ChaseStage from "../../scenes/chase/ChaseStage.svelte";
  import MusicToggle from "../../music/MusicToggle.svelte";
  import Icon from "../../ui/Icon.svelte";
  import { birthDateError, birthDays, birthYears } from "../../domain/birth-date.mjs";

  let { app }: { app: AppController } = $props();
  type Mode="login"|"register"|"confirmation"|"forgot"|"forgot-sent"|"reset";
  const resetToken=new URLSearchParams(location.search).get("reset")??"";
  let mode = $state<Mode>(resetToken?"reset":"login");
  let email = $state(""), password = $state(""), confirm = $state(""), username = $state("");
  let homeBase = $state("Lagos"), showPassword = $state(false), locating = $state(false), locationNote = $state("");
  let dobDay = $state<number>(), dobMonth = $state<number>(), dobYear = $state<number>();
  let dobSubmitted = $state(false), accepted = $state(false);
  const LEGAL = "https://naijachase.com";
  const years = birthYears();
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const days = $derived(birthDays(dobYear, dobMonth));
  $effect(() => {
    if (dobDay !== undefined && !days.includes(dobDay)) dobDay = undefined;
  });
  $effect(() => {
    if (app.confirmationLinkInvalid && mode === "login") mode = "confirmation";
  });
  const dobError = $derived(
    dobSubmitted || (dobDay !== undefined && dobMonth !== undefined && dobYear !== undefined)
      ? birthDateError(dobDay, dobMonth, dobYear) : ""
  );

  const passwordOk = $derived(password.length >= 12);
  const matches = $derived(confirm.length > 0 && confirm === password);
  const strength = $derived(Math.min(4, [password.length >= 12, password.length >= 16, /[A-Z]/.test(password) && /[a-z]/.test(password), /\d/.test(password) || /[^\w\s]/.test(password)].filter(Boolean).length));

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (mode === "login") {
      if (await app.login(email, password)) { password = ""; app.go("cases"); }
      else if (app.confirmationRequiredFor) { email = app.confirmationRequiredFor; password = ""; mode = "confirmation"; }
    } else if(mode==="register") {
      dobSubmitted = true;
      if (!accepted) return;
      if (dobDay === undefined || dobMonth === undefined || dobYear === undefined || birthDateError(dobDay, dobMonth, dobYear)) return;
      if (await app.register({ email, password, confirm, username, homeBase, dobDay, dobMonth, dobYear })) {
        password = ""; confirm = ""; dobDay = undefined; dobMonth = undefined; dobYear = undefined; dobSubmitted = false; accepted = false; mode = "confirmation";
      }
    } else if(mode==="confirmation" && await app.resendConfirmation(email)) {
      app.confirmationLinkInvalid = false;
    } else if(mode==="forgot" && await app.requestPasswordReset(email)){
      mode="forgot-sent";
    } else if(mode==="reset" && matches && await app.completePasswordReset(resetToken,password,confirm)){
      password="";confirm="";mode="login";
    }
  }
  async function locate() {
    locating = true;
    const found = await app.locate();
    locating = false;
    if (found) { homeBase = found; locationNote = `Suggested home base: ${found}. Confirm or change it.`; }
    else locationNote = "Location unavailable. Choose your home base manually.";
  }
</script>

<div class="auth">
  <aside class="auth-side">
    <Brand onclick={() => app.go("welcome")} />
    <div class="chase-wrap"><ChaseStage /></div>
    <div class="auth-quote">
      <Icon name="shield" />
      <p>“Every witness knows something. Your job is to know which part matters.”</p>
      <small class="muted">— Chief Inspector's briefing note</small>
    </div>
  </aside>
  <section class="auth-main">
    <MusicToggle music={app.music} />
    <div class="auth-card card rise">
      <p class="eyebrow">Investigator access</p>
      <h1>{mode === "login" ? "Welcome back" : mode === "register" ? "Join the agency" : mode === "confirmation" ? "Confirm your email" : mode === "reset" ? "Choose a new password" : "Recover your account"}</h1>
      {#if mode==="login"||mode==="register"}<div class="segmented" role="group" aria-label="Account action">
        <button type="button" aria-pressed={mode === "login"} onclick={() => (mode = "login")}>Log in</button>
        <button type="button" aria-pressed={mode === "register"} onclick={() => (mode = "register")}>Create account</button>
      </div>{/if}

      {#if mode==="confirmation"}
        <div class="recovery-sent" role="status">
          <Icon name="mail"/><h2>Check your email</h2>
          <p class="muted">We queued a confirmation link for <strong>{email || "your account email"}</strong>. It expires after 24 hours.</p>
          {#if app.confirmationLinkInvalid}<p class="muted">That confirmation link is invalid, expired, or has already been replaced. Enter your email to request a fresh link.</p>{/if}
          <label class="field"><span>Email</span><input class="input" bind:value={email} required type="email" autocomplete="email" /></label>
          <button class="btn btn-primary btn-block" type="button" disabled={app.busy || !email} onclick={() => app.resendConfirmation(email)}>{app.busy ? `${app.busyLabel}…` : "Resend confirmation email"}</button>
          <button class="auth-link" type="button" onclick={() => { app.confirmationRequiredFor = ""; mode = "login"; }}>Return to login</button>
        </div>
      {:else if mode==="forgot-sent"}
        <div class="recovery-sent" role="status"><Icon name="mail"/><h2>Check your email</h2><p class="muted">If an account exists for <strong>{email}</strong>, we sent a password-reset link. The link expires in 30 minutes.</p><button class="btn btn-primary btn-block" type="button" onclick={() => mode = "login"}>Return to login</button></div>
      {:else}
      <form class="form" class:form-grid={mode === "register"} onsubmit={submit}>
        {#if mode !== "reset"}<label class="field"><span>Email</span><input class="input" bind:value={email} required type="email" autocomplete="email" /></label>{/if}
        {#if mode === "register"}
          <label class="field"><span>Investigator name</span><input class="input" bind:value={username} required minlength="3" maxlength="32" autocomplete="username" /></label>
          <fieldset class="dob-row" aria-describedby="dob-help">
            <legend>Date of birth</legend>
            <div class="dob-inputs">
              <label class="field"><span>Year</span><select class="select" bind:value={dobYear} required autocomplete="bday-year" aria-invalid={Boolean(dobError)}>
                <option value={undefined} disabled>Year</option>
                {#each years as year}<option value={year}>{year}</option>{/each}
              </select></label>
              <label class="field"><span>Month</span><select class="select" bind:value={dobMonth} required autocomplete="bday-month" aria-invalid={Boolean(dobError)}>
                <option value={undefined} disabled>Month</option>
                {#each months as month, index}<option value={index + 1}>{month}</option>{/each}
              </select></label>
              <label class="field"><span>Day</span><select class="select" bind:value={dobDay} required disabled={days.length === 0} autocomplete="bday-day" aria-invalid={Boolean(dobError)}>
                <option value={undefined} disabled>Day</option>
                {#each days as day}<option value={day}>{day}</option>{/each}
              </select></label>
            </div>
            <p id="dob-help" class="muted hint" class:warn={Boolean(dobError)} aria-live="polite">{dobError || "You must be 18 years or older to register."}</p>
          </fieldset>
          <div class="field home-row">
            <span id="home-label">Home base</span>
            <div class="home-inputs">
              <select class="select" aria-labelledby="home-label" bind:value={homeBase}>{#each HOME_BASES as s}<option>{s}</option>{/each}</select>
              <button type="button" class="btn btn-ghost" disabled={locating} onclick={locate}><Icon name="pin" />{locating ? "Locating…" : "Locate me"}</button>
            </div>
            {#if locationNote}<small class="muted" role="status">{locationNote}</small>{/if}
          </div>
        {/if}
        {#if mode !== "forgot"}<label class="field"><span>{mode === "reset" ? "New password" : "Password"}</span>
          <input class="input" bind:value={password} required minlength={mode === "register" || mode === "reset" ? 12 : undefined} type={showPassword ? "text" : "password"} autocomplete={mode === "login" ? "current-password" : "new-password"} />
        </label>{/if}
        {#if mode === "register" || mode === "reset"}
          <label class="field"><span>Confirm password</span><input class="input" bind:value={confirm} required minlength="12" type={showPassword ? "text" : "password"} autocomplete="new-password" aria-invalid={confirm.length > 0 && !matches} /></label>
          <div class="pw-meta">
            <div class="pw-feedback">
              <div class="strength" aria-hidden="true">{#each [1, 2, 3, 4] as n}<i class:on={strength >= n}></i>{/each}</div>
              <p class="muted hint" class:warn={confirm.length > 0 && !matches} role="status">{confirm.length > 0 && !matches ? "Passwords do not match yet." : passwordOk ? "Length requirement met." : "Use at least 12 characters."}</p>
            </div>
            <label class="check"><input type="checkbox" bind:checked={showPassword} /> Show password</label>
          </div>
        {:else if mode === "login"}
          <label class="check"><input type="checkbox" bind:checked={showPassword} /> Show password</label>
        {/if}
        {#if mode === "register"}<label class="check legal"><input type="checkbox" bind:checked={accepted} required /> <span>I am at least 13 and accept the <a href="{LEGAL}/terms.html" target="_blank" rel="noopener">Terms</a>, <a href="{LEGAL}/privacy.html" target="_blank" rel="noopener">Privacy Policy</a> and <a href="{LEGAL}/disclaimer.html" target="_blank" rel="noopener">Disclaimer</a>.</span></label>{/if}
        {#if mode === "login"}<button class="auth-link" type="button" onclick={() => (mode = "forgot")}>Forgot password?</button>{/if}
        <button class="btn btn-primary btn-lg btn-block submit" disabled={app.busy || ((mode === "register" || mode === "reset") && !matches) || (mode === "register" && (Boolean(dobError) || !accepted))}>
          {#if app.busy}<span class="spinner"></span> {app.busyLabel}…{:else}{mode === "login" ? "Log in" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Change password"}{/if}
        </button>
        {#if mode === "forgot" || mode === "reset"}<button class="auth-link" type="button" onclick={() => (mode = "login")}>Back to login</button>{/if}
      </form>
      {/if}
    </div>
  </section>
</div>
