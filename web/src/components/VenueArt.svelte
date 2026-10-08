<script lang="ts">
  // Line drawings for the places a local lead can send you to, in the terminal's phosphor style. Each venue the game knows has
  // its own picture (a museum is columns, a university a clock tower, a motor park a danfo bus); anything the server adds
  // later falls back to a map pin. Decorative: the lead's name carries the meaning.
  let { id }: { id: string } = $props();
</script>

<svg class="venue-art" viewBox="0 0 120 80" aria-hidden="true" focusable="false">
  <path class="ln" d="M4 70H116" />
  {#if id === "market" || id === "craft_market"}
    {#each [8, 46, 84] as x, i}
      <path class={i === 1 ? "ac" : "fl"} d="M{x} 38h28l-4-12H{x + 4}z" />
      <path class="ln" d="M{x + 7} 26l-2 12M{x + 14} 26v12M{x + 21} 26l2 12M{x + 2} 38v32M{x + 26} 38v32" />
      <path class="fl" d="M{x + 2} 56h24v6H{x + 2}z" />
      {#if id === "craft_market"}<ellipse class="ac" cx={x + 8} cy="52" rx="4" ry="4.5" /><ellipse class="ln" cx={x + 19} cy="52" rx="3.5" ry="4" />{:else}<circle class="ac" cx={x + 9} cy="53" r="3" /><circle class="ln" cx={x + 16} cy="53" r="3" /><circle class="ac" cx={x + 22} cy="53" r="3" />{/if}
    {/each}
  {:else if id === "library"}
    <path class="fl" d="M18 70V34l42-16 42 16v36z" /><path class="ln" d="M18 34h84M28 40v30M44 40v30M76 40v30M92 40v30" />
    <path class="ac" d="M52 70V52h16v18z" /><path class="ac" d="M34 28h12v6H34zM74 28h12v6H74z" /><path class="ln" d="M60 6v4" />
  {:else if id === "university"}
    <path class="fl" d="M10 70V44h30V30h40v14h30v26z" /><path class="fl" d="M52 30V12h16v18z" /><path class="ac" d="M50 12l10-8 10 8z" />
    <circle class="ln" cx="60" cy="20" r="3.5" /><path class="ln" d="M60 20v-2M60 20h2M20 54h8M92 54h8M20 62h8M92 62h8M52 70V54h16v16z" />
    <path class="ac" d="M96 18l10-4 10 4-10 4zM100 21v5q6 3 12 0v-5" />
  {:else if id === "museum"}
    <path class="fl" d="M12 30L60 10l48 20z" /><path class="ln" d="M16 70V34M30 70V34M44 70V34M76 70V34M90 70V34M104 70V34M12 34h96" />
    <path class="ac" d="M50 70V50h20v20z" /><path class="ln" d="M8 70h104M10 66h100" /><circle class="ac" cx="60" cy="22" r="4" />
  {:else if id === "hospital"}
    <path class="fl" d="M20 70V26h80v44z" /><path class="ac" d="M54 30h12v10h10v12H66v10H54V52H44V40h10z" />
    <path class="ln" d="M28 36h10M28 48h10M82 36h10M82 48h10M52 70V62h16v8" />
  {:else if id === "church"}
    <path class="fl" d="M24 70V44h40v26z" /><path class="fl" d="M64 70V50h30v20z" /><path class="fl" d="M30 44V24l14-12 14 12v20" />
    <path class="ac" d="M44 12V2M40 6h8" /><path class="ln" d="M44 70V58q0-6 6-6t6 6v12M74 58h10v12H74z" /><circle class="ln" cx="44" cy="32" r="4" />
  {:else if id === "mosque"}
    <path class="fl" d="M30 70V46h60v24z" /><path class="fl" d="M38 46q22-34 44 0z" /><path class="ac" d="M60 18v-8M56 10q4-5 8 0" />
    {#each [14, 100] as x}<path class="fl" d="M{x} 70V30h8v40z" /><path class="ac" d="M{x - 1} 30q5-12 10 0zM{x + 4} 18v-6" />{/each}
    <path class="ln" d="M52 70V58q0-8 8-8t8 8v12" />
  {:else if id === "nightclub"}
    <path class="fl" d="M16 70V34h88v36z" /><path class="ac" d="M36 22h48v10H36z" /><path class="ln" d="M44 27h32" /><path class="ac" d="M56 14l4-6 4 6M20 22l6-8M100 22l-6-8" />
    <path class="ln" d="M24 44h14v26H24zM82 44h14v26H82zM54 70V52h12v18z" /><circle class="ac" cx="103" cy="12" r="5" /><path class="ln" d="M8 40l8 6M112 40l-8 6" />
  {:else if id === "motor_park"}
    <path class="fl" d="M12 62V34q0-6 6-6h60q8 0 14 8l14 10v16z" /><path class="ln" d="M18 40h74M38 28v34" />
    <path class="ac" d="M20 32h16v8H20zM42 32h14v8H42zM60 32h14v8H60zM80 38h10l8 6H80z" /><circle class="ac" cx="32" cy="64" r="7" /><circle class="ac" cx="90" cy="64" r="7" />
    <path class="ln" d="M20 52h82" /><path class="ac" d="M44 20h22v6H44z" /><path class="ln" d="M104 28l8-4M8 70h8" />
  {:else if id === "hotel"}
    <path class="fl" d="M30 70V10h60v60z" />{#each [18, 30, 42, 54] as y}<path class="ln" d="M38 {y}h8M56 {y}h8M74 {y}h8" />{/each}
    <path class="ac" d="M46 70V60h28v10zM38 4h44v6H38z" /><path class="ln" d="M50 7h20" />
  {:else if id === "restaurant"}
    <path class="fl" d="M22 70V38h76v32z" /><path class="ac" d="M16 38h88l-8-12H24z" /><path class="ln" d="M36 26l-4 12M60 26v12M84 26l4 12M32 48h20v14H32zM68 48h20v14H68z" />
    <path class="ac" d="M52 12q8-8 16 0M50 14h20" /><path class="ln" d="M56 6q-2-3 0-5M64 6q2-3 0-5" />
  {:else if id === "airport"}
    <path class="fl" d="M8 56q0-10 14-10h54q22 0 30 8-8 8-30 8H22q-14 0-14-6z" /><path class="ac" d="M50 46l-14-24h8l22 24zM50 62l-14 8h8l22-8z" />
    <path class="ln" d="M96 54l10-10h4l-4 10M20 52h8M34 52h8M48 52h8" /><path class="fl" d="M102 70V30h10v40z" /><path class="ac" d="M99 30h16v-6H99z" />
  {:else if id === "radio_station"}
    <path class="ln" d="M60 8L46 70M60 8l14 62M52 40h16M48 56h24M55 24h10" /><path class="ac" d="M76 12q8 6 0 12M82 8q14 10 0 20M44 12q-8 6 0 12M38 8q-14 10 0 20" />
    <path class="fl" d="M80 70V54h30v16z" /><path class="ln" d="M86 62h8" /><circle class="ac" cx="60" cy="8" r="2.5" />
  {:else if id === "beach"}
    <circle class="ac" cx="94" cy="20" r="9" /><path class="ln" d="M94 6v-4M104 10l3-3M108 20h4M80 10l-3-3" />
    <path class="ln" d="M6 54q7-6 14 0t14 0 14 0 14 0 14 0 14 0M10 62q7-6 14 0t14 0 14 0 14 0 14 0" /><path class="fl" d="M6 70q30-10 108 0z" />
    <path class="ln" d="M30 70Q32 50 38 34" /><path class="ac" d="M38 34q-12-4-20 6q10-4 20-6zM38 34q10-8 20-2q-12-2-20 2zM38 34q-4-12 6-18q-4 10-6 18z" />
  {:else if id === "carnival_workshop"}
    <path class="fl" d="M38 20q22-16 44 0 6 24-22 44-28-20-22-44z" /><path class="ac" d="M46 32q6-4 12 2-6 4-12-2zM74 32q-6-4-12 2 6 4 12-2z" /><path class="ln" d="M60 40v10M52 54q8 6 16 0" />
    <path class="ac" d="M36 22L22 6M44 14L36 2M76 14l8-12M84 22l14-16" /><path class="ln" d="M20 70h20M80 70h24" />
  {:else if id === "cattle_market"}
    <path class="fl" d="M30 40h46q10 0 12 8v8H30z" /><path class="fl" d="M76 40l12-8 10 4v12l-8 6-12-6z" /><path class="ac" d="M86 32l-2-8M96 34l4-6" />
    <path class="ln" d="M36 56v14M48 56v14M70 56v14M82 56v14M30 44l-8 6" /><path class="ln" d="M6 54h12M6 62h12M10 50v20M18 50v20M104 56h10M104 64h10M108 52v18" />
  {:else if id === "community_hall"}
    <path class="fl" d="M12 70V34l48-18 48 18v38z" transform="translate(0 -2)" /><path class="ac" d="M48 68V46h24v22z" /><path class="ln" d="M24 44h14v10H24zM82 44h14v10H82z" />
    <path class="ln" d="M60 16V4" /><path class="ac" d="M60 4h14l-4 4 4 4H60z" /><path class="ln" d="M6 30q27 10 54 0t54 0" />
  {:else if id === "conservation_office"}
    <path class="fl" d="M34 70V42l26-14 26 14v28z" /><path class="ln" d="M52 70V54h16v16" /><path class="ac" d="M56 36q4-8 12 0-4 8-12 0zM62 36l-4 6" />
    <path class="fl" d="M10 70V50M10 50q-8-6-4-14 8 0 8 14zM110 70V46M110 46q8-4 6-14-10 2-10 14z" /><path class="ln" d="M18 70h-16M118 70h-16" />
  {:else if id === "emir_palace" || id === "palace"}
    <path class="fl" d="M14 70V36h92v34z" /><path class="ln" d="M14 36l6-6 6 6 6-6 6 6 6-6 6 6M72 36l6-6 6 6 6-6 6 6 6-6 6 6" />
    <path class="fl" d="M42 36q18-30 36 0z" /><path class="ac" d="M60 14V6M56 6q4-4 8 0" /><path class="ac" d="M50 70V54q0-8 10-8t10 8v16z" />
    <path class="ln" d="M24 50h12v20H24zM84 50h12v20H84z" />
  {:else if id === "traditional_council"}
    <path class="fl" d="M24 70V44h72v26z" /><path class="ac" d="M16 44L60 10l44 34z" /><path class="ln" d="M30 36l6 6M42 28l6 8M54 20l6 12M66 20l-6 12M78 28l-6 8M90 36l-6 6" />
    <path class="ln" d="M36 70V54h12v16M72 70V54h12v16M54 70V56h12v14" /><path class="ac" d="M10 70h14M96 70h14M14 66h6v4h-6zM100 66h6v4h-6z" />
  {:else if id === "factory_gate"}
    <path class="fl" d="M10 70V44l16 8V44l16 8V44l16 8V44l16 8v18z" /><path class="fl" d="M82 70V16h12v54z" /><path class="ln" d="M78 16h20" />
    <path class="ln" d="M86 10q-4-4 0-8M94 12q6-4 2-9" /><path class="ac" d="M96 70V50h4v20M110 70V50h-4v20M100 54h6" /><path class="ln" d="M20 62h8M36 62h8M52 62h8" />
  {:else if id === "farm"}
    <path class="fl" d="M60 70V36l16-14 16 14v34z" /><path class="ac" d="M70 70V52h12v18z" /><path class="ln" d="M60 36h32M76 22V16" />
    <path class="ln" d="M6 70l12-14M16 70l12-14M26 70l12-14M36 70l12-14M46 70l12-14" /><circle class="ac" cx="20" cy="22" r="8" /><path class="ln" d="M20 8v-4M8 22H4M34 22h4" />
  {:else if id === "festival_ground"}
    <path class="fl" d="M22 70V38L60 12l38 26v32z" /><path class="ac" d="M60 12l-12 58M60 12l12 58M60 12L36 70M60 12l24 58" /><path class="ln" d="M52 70V54h16v16" />
    <path class="ac" d="M4 20q28 14 56 0t56 0" /><path class="ln" d="M10 24l-2 8M26 28l-2 8M44 28l-2 8M76 28l-2 8M94 24l-2 8M110 22l-2 8" />
  {:else if id === "fishing_jetty" || id === "jetty"}
    <path class="ln" d="M6 58q7-5 14 0t14 0 14 0 14 0 14 0 14 0 14 0" /><path class="fl" d="M40 52h76v6H40z" /><path class="ln" d="M48 58v12M64 58v12M80 58v12M96 58v12M110 58v12" />
    <path class="fl" d="M8 50q2 8 12 8h20q6 0 8-8z" /><path class="ac" d="M24 50V24l16 24z" /><path class="ln" d="M24 24V18" />
    {#if id === "jetty"}<path class="ac" d="M86 52v-8h10v8z" /><path class="ln" d="M100 52v-6h8v6" />{:else}<path class="ac" d="M84 46q6-6 12 0-6 6-12 0zM100 44q5-5 10 0-5 5-10 0z" />{/if}
  {:else if id === "waterfront"}
    <path class="ln" d="M6 54q7-5 14 0t14 0 14 0 14 0 14 0 14 0 14 0M6 62q7-5 14 0t14 0 14 0 14 0 14 0 14 0 14 0" /><path class="fl" d="M4 46h112v8H4z" />
    <path class="ln" d="M20 46V28M60 46V28M100 46V28" /><path class="ac" d="M16 24h8v4h-8zM56 24h8v4h-8zM96 24h8v4h-8z" /><path class="ln" d="M20 28q20-8 40 0t40 0" />
  {:else if id === "seaport"}
    <path class="ln" d="M4 62q7-5 14 0t14 0 14 0 14 0 14 0 14 0 14 0 14 0" /><path class="fl" d="M8 54l8 8h56l10-8z" /><path class="ac" d="M20 54V44h12v10zM34 54V44h12v10zM48 54V44h12v10z" />
    <path class="ln" d="M96 70V16M96 16H78M96 24l-20 0M78 16v14" /><path class="fl" d="M88 70V58h20v12zM100 58V48h14v10z" />
  {:else if id === "mining_site"}
    <path class="fl" d="M4 70L36 24l20 26 18-18 42 38z" /><path class="ln" d="M36 24l8 10-6 4 6 8" /><path class="ac" d="M80 70V40l-8 30M80 40l8 30M72 54h16" />
    <path class="fl" d="M92 66h16l-3 8H95z" transform="translate(0 -8)" /><circle class="ac" cx="96" cy="68" r="2.5" /><circle class="ac" cx="106" cy="68" r="2.5" />
  {:else if id === "monument"}
    <path class="fl" d="M52 66L56 10h8l4 56z" /><path class="ac" d="M56 10l4-6 4 6z" /><path class="ln" d="M44 66h32v4H44zM36 70h48" />
    <path class="ac" d="M20 30l2 5 5 .5-4 3.5 1 5-5-3-5 3 1-5-4-3.5 5-.5zM100 30l2 5 5 .5-4 3.5 1 5-5-3-5 3 1-5-4-3.5 5-.5z" />
  {:else if id === "police_station"}
    <path class="fl" d="M16 70V32h88v38z" /><path class="ln" d="M16 32h88M44 70V52h32v18" /><path class="ac" d="M60 36q-10 2-12 8 0 8 12 12 12-4 12-12-2-6-12-8z" />
    <path class="ac" d="M52 24h16v8H52z" /><path class="ln" d="M60 24v-6M56 18h8M26 44h10v8H26zM84 44h10v8H84z" />
  {:else if id === "railway_station"}
    <path class="fl" d="M6 70V40h52v30z" /><path class="ln" d="M6 40l10-8h32l10 8" /><path class="fl" d="M24 32V10h14v22z" /><circle class="ac" cx="31" cy="20" r="4" />
    <path class="fl" d="M64 70V46q0-6 6-6h30q10 0 14 12v18z" /><path class="ac" d="M72 46h12v8H72zM90 46h12v8H90z" /><circle class="ln" cx="76" cy="70" r="5" /><circle class="ln" cx="100" cy="70" r="5" /><path class="ln" d="M108 52h6" />
  {:else if id === "refinery"}
    <path class="fl" d="M8 70V40q0-6 10-6t10 6v30zM34 70V44q0-6 10-6t10 6v26z" /><path class="fl" d="M80 70V14h8v56z" /><path class="ac" d="M84 14q-8-6-2-14 2 6 8 4-2 6-6 10z" />
    <path class="ln" d="M28 54h6M54 56h26M62 56v14M70 56v14M96 70V40h14v30z" />
  {:else if id === "sacred_grove"}
    <path class="fl" d="M18 70V50M18 50q-14-4-10-20 8-10 20-4 14 0 12 14-4 10-12 10z" /><path class="fl" d="M100 70V46M100 46q-14-2-12-16 8-12 22-6 10 6 6 16-4 6-16 6z" />
    <path class="ln" d="M60 70V40M60 40q-18-2-16-20 8-14 24-8 12 8 6 20-4 8-14 8z" /><path class="ac" d="M50 70V62h20v8zM54 62l6-8 6 8" /><circle class="ac" cx="30" cy="62" r="1.5" /><circle class="ac" cx="88" cy="62" r="1.5" />
  {:else}
    <path class="fl" d="M60 8q-20 0-20 20 0 14 20 34 20-20 20-34 0-20-20-20z" /><circle class="ac" cx="60" cy="28" r="7" /><path class="ln" d="M20 70q20-8 40 0t40 0" />
  {/if}
</svg>
