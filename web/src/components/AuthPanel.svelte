<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import { HOME_BASES } from "../model.ts";
  import Brand from "./Brand.svelte";
  import ChaseStage from "./ChaseStage.svelte";
  import MusicToggle from "./MusicToggle.svelte";
  import Icon from "./Icon.svelte";

  let { app }: { app: AppController } = $props();
  type Mode="login"|"register"|"forgot"|"forgot-sent"|"reset";
  const resetToken=new URLSearchParams(location.search).get("reset")??"";
  let mode = $state<Mode>(resetToken?"reset":"login");
  let email = $state(""), password = $state(""), confirm = $state(""), username = $state("");
  let homeBase = $state("Lagos"), showPassword = $state(false), locating = $state(false), locationNote = $state("");

  const passwordOk = $derived(password.length >= 12);
  const matches = $derived(confirm.length > 0 && confirm === password);
  const strength = $derived(Math.min(4, [password.length >= 12, password.length >= 16, /[A-Z]/.test(password) && /[a-z]/.test(password), /\d/.test(password) || /[^\w\s]/.test(password)].filter(Boolean).length));

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (mode === "login") {
      if (await app.login(email, password)) { password = ""; app.go("cases"); }
    } else if(mode==="register" && await app.register({ email, password, confirm, username, homeBase })) {
      password = ""; confirm = ""; mode = "login";
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
      <h1>{mode === "login" ? "Welcome back" : mode === "register" ? "Join the agency" : mode === "reset" ? "Choose a new password" : "Recover your account"}</h1>
      {#if mode==="login"||mode==="register"}<div class="segmented" role="group" aria-label="Account action">
        <button type="button" aria-pressed={mode === "login"} onclick={() => (mode = "login")}>Log in</button>
        <button type="button" aria-pressed={mode === "register"} onclick={() => (mode = "register")}>Create account</button>
      </div>{/if}

      {#if mode==="forgot-sent"}
        <div class="recovery-sent" role="status"><Icon name="mail"/><h2>Check your email</h2><p class="muted">If an account exists for <strong>{email}</strong>, we sent a password-reset link. The link expires in 30 minutes.</p><button class="btn btn-primary btn-block" type="button" onclick={() => mode = "login"}>Return to login</button></div>
      {:else}
      <form class="form" class:form-grid={mode === "register"} onsubmit={submit}>
        {#if mode !== "reset"}<label class="field"><span>Email</span><input class="input" bind:value={email} required type="email" autocomplete="email" /></label>{/if}
        {#if mode === "register"}
          <label class="field"><span>Investigator name</span><input class="input" bind:value={username} required minlength="3" maxlength="32" autocomplete="username" /></label>
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
        {#if mode === "login"}<button class="auth-link" type="button" onclick={() => (mode = "forgot")}>Forgot password?</button>{/if}
        <button class="btn btn-primary btn-lg btn-block submit" disabled={app.busy || ((mode === "register" || mode === "reset") && !matches)}>
          {#if app.busy}<span class="spinner"></span> {app.busyLabel}…{:else}{mode === "login" ? "Log in" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Change password"}{/if}
        </button>
        {#if mode === "forgot" || mode === "reset"}<button class="auth-link" type="button" onclick={() => (mode = "login")}>Back to login</button>{/if}
      </form>
      {/if}
    </div>
  </section>
</div>
