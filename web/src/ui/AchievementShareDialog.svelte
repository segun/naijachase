<script lang="ts">
  import type { AppController } from "../state/app.svelte";
  import { achievementCardFile, achievementSharePayload, SHARE_NETWORKS, socialShareUrl, type ShareNetwork } from "../domain/achievement-share.ts";
  import MoveDialog from "../screens/case/MoveDialog.svelte";
  import Icon from "./Icon.svelte";

  let { app }: { app: AppController } = $props();
  const notice = $derived(app.achievementShare!);
  const payload = $derived(achievementSharePayload(notice.achievement, app.investigator));
  const nativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  let image = $state<File | null>(null);
  let imageError = $state("");
  let status = $state("");

  $effect(() => {
    const achievement = notice.achievement, investigator = app.investigator;
    let current = true;
    image = null; imageError = "";
    achievementCardFile(achievement, investigator)
      .then(file => { if (current) image = file; })
      .catch(error => { if (current) imageError = error instanceof Error ? error.message : String(error); });
    return () => { current = false; };
  });

  const canShareImage = $derived(Boolean(image && typeof navigator !== "undefined" && navigator.canShare?.({ files: [image] })));

  async function shareNative() {
    status = "";
    try {
      if (image && canShareImage) {
        await navigator.share({ title: payload.title, text: `${payload.text}\n${payload.url}`, files: [image] });
      } else {
        await navigator.share(payload);
      }
      status = "Shared.";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      status = error instanceof Error ? error.message : "The share menu could not be opened.";
    }
  }

  function shareNetwork(network: ShareNetwork) {
    window.open(socialShareUrl(network, payload), "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`); status = "Post text and link copied."; }
    catch { status = "Copy failed. Select and copy the link below."; }
  }

  function downloadImage() {
    if (!image) return;
    const url = URL.createObjectURL(image);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = image.name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
</script>

<MoveDialog title={notice.newlyEarned ? "Achievement unlocked" : "Share achievement"} subtitle={notice.newlyEarned ? "Your career file has been updated." : "Share this achievement again whenever you like."} onclose={() => app.dismissAchievementShare()}>
  <div class="achievement-share-card" aria-label="Achievement share card preview">
    <div><span>Naija Chase</span><small>Achievement unlocked</small></div>
    <Icon name="trophy" />
    <strong>{notice.achievement.title}</strong>
    <p>{notice.achievement.description}</p>
    <footer><span>{app.investigator}</span><span>naijachase.app</span></footer>
  </div>

  <p class="muted">The shared post includes achievement text, an image and a link to Naija Chase.</p>
  {#if nativeShare}
    <button class="btn btn-primary share-native" type="button" disabled={!image && !imageError} onclick={shareNative}>
      <Icon name="arrow" /> {canShareImage ? "Share image and link" : imageError ? "Open share menu" : "Preparing image…"}
    </button>
  {/if}
  <div class="achievement-share-networks" aria-label="Share to a social network">
    {#each SHARE_NETWORKS as network}
      <button class="btn btn-ghost" type="button" onclick={() => shareNetwork(network.id)}>{network.label}</button>
    {/each}
  </div>
  <div class="achievement-share-tools">
    <button class="btn btn-ghost" type="button" onclick={copyLink}>Copy post and link</button>
    <button class="btn btn-ghost" type="button" disabled={!image} onclick={downloadImage}>Download image</button>
  </div>
  <p class="achievement-share-url mono">{payload.url}</p>
  {#if status}<p class="muted" role="status">{status}</p>{/if}
  <button class="btn btn-ghost" type="button" onclick={() => app.dismissAchievementShare()}>Close</button>
</MoveDialog>

<style>
  .achievement-share-card { display: grid; grid-template-columns: 1fr auto; gap: .55rem 1rem; padding: 1.15rem; border: 2px solid var(--green); border-radius: 14px; background: linear-gradient(145deg, #061c17, #103d31); color: #fff8df; box-shadow: inset 0 0 2rem rgb(61 230 161 / .08); }
  .achievement-share-card > div { display: grid; gap: .1rem; color: #3de6a1; text-transform: uppercase; letter-spacing: .12em; font-weight: 800; }
  .achievement-share-card > div small { color: #f4c64e; letter-spacing: .08em; }
  .achievement-share-card > :global(.icon) { grid-row: span 2; align-self: center; color: #f4c64e; font-size: 2.8rem; }
  .achievement-share-card > strong { grid-column: 1 / -1; color: #f4c64e; font-size: clamp(1.5rem, 6vw, 2.2rem); line-height: 1; }
  .achievement-share-card > p { grid-column: 1 / -1; margin: 0; color: #c9ded6; }
  .achievement-share-card > footer { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 1rem; padding-top: .65rem; border-top: 1px solid rgb(61 230 161 / .35); color: #3de6a1; font-size: .78rem; font-weight: 700; }
  .share-native { width: 100%; }
  .achievement-share-networks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .5rem; }
  .achievement-share-networks :global(.btn) { min-width: 0; padding-inline: .5rem; }
  .achievement-share-tools { display: flex; gap: .5rem; flex-wrap: wrap; }
  .achievement-share-tools > * { flex: 1; }
  .achievement-share-url { margin: 0; overflow-wrap: anywhere; color: var(--muted); font-size: .75rem; }
  @media (max-width: 480px) { .achievement-share-networks { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
