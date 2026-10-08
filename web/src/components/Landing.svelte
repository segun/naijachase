<script lang="ts">
  import type { AppController } from "../lib/app.svelte";
  import Brand from "./Brand.svelte";
  import Icon from "./Icon.svelte";
  import MusicToggle from "./MusicToggle.svelte";
  import NigeriaArt from "./NigeriaArt.svelte";

  let { app }: { app: AppController } = $props();
  const steps = [
    { icon: "chat", title: "Question witnesses", text: "Traders, drivers and librarians each remember something different." },
    { icon: "id", title: "Build the dossier", text: "Turn what you hear into eight details about the thief." },
    { icon: "plane", title: "Follow the trail", text: "Fly or drive across 36 states and the FCT before Monday 07:00." }
  ];
</script>

<div class="landing">
  <header class="landing-bar">
    <Brand />
    <div class="landing-actions"><MusicToggle music={app.music} /><button class="btn btn-ghost" type="button" onclick={() => app.go("cases")}>Log in</button></div>
  </header>
  <section class="hero">
    <div class="hero-copy rise">
      <p class="eyebrow">Nigeria is your beat</p>
      <h1>A thief is on the move.<br /><em>Catch them first.</em></h1>
      <p class="lead">A priceless object is missing. Question witnesses, decode Nigerian clues, build the suspect's dossier and secure the right warrant before the week runs out.</p>
      <div class="hero-actions">
        <button class="btn btn-primary btn-lg" type="button" onclick={() => app.go("cases")}>Begin investigation <Icon name="arrow" /></button>
        <span class="muted">A growing catalogue of cases across 37 jurisdictions</span>
      </div>
    </div>
    <div class="hero-art rise" style:animation-delay=".15s"><NigeriaArt /></div>
  </section>
  <section class="steps" aria-label="How it works">
    {#each steps as step, i}
      <article class="step rise" style:animation-delay="{0.25 + i * 0.1}s">
        <span class="step-icon"><Icon name={step.icon} /></span>
        <h2>{step.title}</h2>
        <p class="muted">{step.text}</p>
      </article>
    {/each}
  </section>
</div>
