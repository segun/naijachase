<script lang="ts">
  // The local leads as terminal tiles: the venues the server offers here, with the fare and time of the cheapest way to get there.
  // Used by the case briefing and by the case terminal. Choosing a lead is the parent's business (it plays the walk out of the office).
  import { leadInfo } from "../../domain/venues.ts";
  import { cheapest, duration, money, quoteMinutes, type QuoteGroup, type TransportQuote } from "../../domain/model.ts";
  import Icon from "../../ui/Icon.svelte";
  import VenueArt from "./VenueArt.svelte";

  let { leads, loaded, leaving = "", questioned = [], onpick, closedUntil, empty = "No one is available to question right now." }: {
    leads: QuoteGroup[];
    loaded: boolean;
    /** The id of the lead being visited, or "". */
    leaving?: string;
    /** Ids of the leads already questioned at this stop. */
    questioned?: readonly string[];
    onpick: (lead: QuoteGroup) => void;
    /** Weekly play: when a venue that would be shut on arrival opens (null if open). Such leads cannot be visited. */
    closedUntil?: (q: TransportQuote) => string | null;
    empty?: string;
  } = $props();
</script>

<div class="t-lead-grid">
  {#if !loaded}
    {#each [1, 2, 3] as n}<div class="t-lead t-wait" aria-hidden="true">Scanning…</div>{/each}
  {:else if leads.length === 0}
    <p class="t-line">{empty}</p>
  {/if}
  {#each leads as lead, i (lead.id)}
    {@const info = leadInfo(lead.id)}
    {@const open = lead.options.filter(o => !closedUntil?.(o))}
    {@const shut = closedUntil && lead.options.length > 0 && open.length === 0}
    {@const reopens = shut ? lead.options.map(o => closedUntil!(o)).find(Boolean) : null}
    {@const best = cheapest(open.filter(o => o.affordable))}
    {@const seen = questioned.includes(lead.id)}
    <button class="t-opt t-lead" class:chosen={leaving === lead.id} class:seen type="button" data-nav data-primary={i === 0 ? "" : undefined} disabled={Boolean(leaving) || seen || lead.options.length === 0 || Boolean(shut)} onclick={() => onpick(lead)}>
      <span class="t-art"><VenueArt id={lead.id} /></span>
      <span class="t-label">{lead.label}<small>{info.who}</small><small class="t-blurb">{info.blurb}</small></span>
      <span class="t-fare">
        {#if leaving === lead.id}Heading out…
        {:else if seen}<Icon name="check" /> Questioned
        {:else if shut}Closed · opens {reopens}
        {:else if best}{best.cost === 0 ? "Free" : money(best.cost)} · {duration(quoteMinutes(best))}
        {:else}Unavailable{/if}
      </span>
    </button>
  {/each}
</div>
