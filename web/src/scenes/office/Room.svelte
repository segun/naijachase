<script lang="ts">
  // The signed-in home: the avatar walks into the office, sits at the computer and the camera zooms into the monitor, where the agency
  // terminal takes over. The same room hosts the case: while a case is open the terminal shows the case (CaseTerminal) and the player
  // never leaves the computer except to visit a lead. Coming back from a venue plays a short return (seated, then the zoom).
  import { onMount } from "svelte";
  import type { AppController } from "../../state/app.svelte";
  import { isCaseScreen } from "../../domain/model.ts";
  import CaseDesk from "./CaseDesk.svelte";
  import CaseTerminal from "./CaseTerminal.svelte";
  import Stage from "../shared/Stage.svelte";
  import { T_RETURN_FROM } from "./room-scene.ts";

  let { app }: { app: AppController } = $props();
  // Whether this is a return from a venue is fixed when the room opens; it is used up so a later visit to the desk does not repeat it.
  // svelte-ignore state_referenced_locally
  const quick = app.returning;
  onMount(() => { app.returning = false; });
  const inCase = $derived(app.game !== null && !app.briefing && isCaseScreen(app.screen));
</script>

<Stage {app} seenKey="nc-desk" {quick} introFrom={T_RETURN_FROM} load={(canvas, options) => import("./chase3d-room.ts").then(m => m.createRoomScene(canvas, options))}>
  {#snippet children(awake, leave)}
    {#if inCase}<CaseTerminal {app} {awake} {leave} />{:else}<CaseDesk {app} {awake} {leave} />{/if}
  {/snippet}
</Stage>
