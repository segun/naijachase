<script lang="ts">
  // The signed-in home: the avatar walks into the office, sits at the computer and the camera zooms into the monitor,
  // where the agency terminal (CaseDesk) takes over.
  import type { AppController } from "../../state/app.svelte";
  import CaseDesk from "./CaseDesk.svelte";
  import Stage from "../shared/Stage.svelte";

  let { app }: { app: AppController } = $props();
</script>

<Stage {app} seenKey="nc-desk" load={(canvas, options) => import("./chase3d-room.ts").then(m => m.createRoomScene(canvas, options))}>
  {#snippet children(awake, leave)}<CaseDesk {app} {awake} {leave} />{/snippet}
</Stage>
