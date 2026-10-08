<script lang="ts">
  // Decorative: a police officer chasing a masked thief with a sack of loot through a Nigerian city at night.
  const far = [[0, 40, 110], [45, 30, 160], [80, 50, 90], [135, 35, 140], [175, 45, 185], [225, 40, 120], [270, 55, 150], [330, 35, 100], [370, 50, 170], [425, 55, 125]];
  const near = [[0, 70, 190], [75, 55, 140], [135, 80, 220], [220, 60, 160], [285, 75, 200], [365, 55, 145], [425, 55, 180]];
  const GROUND = 316;
  const windows = (x: number, w: number, h: number, seed: number) => {
    const out: { x: number; y: number; lit: boolean }[] = [];
    for (let col = 0; col < Math.floor((w - 10) / 16); col++)
      for (let row = 0; row < Math.floor((h - 16) / 22); row++)
        out.push({ x: x + 8 + col * 16, y: GROUND - h + 12 + row * 22, lit: (seed + col * 7 + row * 3) % 4 === 0 });
    return out;
  };
</script>

{#snippet leg(cls: string, colour: string)}
  <g transform="translate(0 -46)"><g class="leg {cls}">
    <line x1="0" y1="0" x2="0" y2="21" stroke={colour} stroke-width="9" stroke-linecap="round" />
    <g transform="translate(0 21)"><g class="shin {cls}">
      <line x1="0" y1="0" x2="0" y2="21" stroke={colour} stroke-width="8" stroke-linecap="round" />
      <path d="M-3 22 h12" stroke="#0b0b0b" stroke-width="6" stroke-linecap="round" />
    </g></g>
  </g></g>
{/snippet}

{#snippet arm(cls: string, colour: string, skin: string)}
  <g transform="translate(0 -76)"><g class="arm {cls}">
    <line x1="0" y1="0" x2="0" y2="14" stroke={colour} stroke-width="7" stroke-linecap="round" />
    <g transform="translate(0 14)"><g class="forearm">
      <line x1="0" y1="0" x2="0" y2="13" stroke={skin} stroke-width="6" stroke-linecap="round" />
    </g></g>
  </g></g>
{/snippet}

<svg class="chase" viewBox="0 0 480 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="chase-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#03110d" /><stop offset=".7" stop-color="#0b2c22" /><stop offset="1" stop-color="#134536" />
    </linearGradient>
    <pattern id="chase-stripes" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="3" fill="#f4f1e6" /><rect y="3" width="6" height="3" fill="#161616" /></pattern>
    <radialGradient id="chase-glow"><stop offset="0" stop-color="#fff" stop-opacity=".9" /><stop offset="1" stop-color="#fff" stop-opacity="0" /></radialGradient>
    <g id="chase-far">{#each far as [x, w, h]}<rect {x} y={GROUND - h!} width={w} height={h} fill="#0a2a20" />{/each}</g>
    <g id="chase-near">
      {#each near as [x, w, h], i}
        <rect x={x} y={GROUND - h!} width={w} height={h} fill="#0f3a2c" />
        {#each windows(x!, w!, h!, i) as win}<rect x={win.x} y={win.y} width="8" height="12" fill={win.lit ? "#f2c14e" : "#0a2a20"} opacity={win.lit ? ".85" : "1"} />{/each}
      {/each}
    </g>
  </defs>

  <rect width="480" height="400" fill="url(#chase-sky)" />
  <circle cx="392" cy="70" r="28" fill="#f4ecc4" opacity=".92" /><circle cx="402" cy="62" r="24" fill="#03110d" opacity=".25" />
  {#each [[40, 40], [110, 90], [190, 30], [260, 80], [330, 38], [450, 120], [60, 140]] as [sx, sy]}<circle class="star" cx={sx} cy={sy} r="1.6" fill="#fff" />{/each}

  <g class="scroll far"><use href="#chase-far" /><use href="#chase-far" x="480" /></g>
  <g class="scroll near"><use href="#chase-near" /><use href="#chase-near" x="480" /></g>

  <rect y={GROUND} width="480" height="84" fill="#0c231b" />
  <rect y={GROUND} width="480" height="8" fill="#17402f" />
  <line class="lane" x1="0" y1="392" x2="480" y2="392" stroke="#f2c14e" stroke-opacity=".55" stroke-width="3" stroke-dasharray="26 22" />

  <rect class="siren red" width="480" height="400" fill="#ff3b30" />
  <rect class="siren blue" width="480" height="400" fill="#2f7bff" />

  {#each [
    { cls: "c3", x: 78, y: 366, s: 1.18, baton: false },
    { cls: "c1", x: 150, y: 374, s: 1.32, baton: true },
    { cls: "c2", x: 222, y: 382, s: 1.38, baton: true }
  ] as o}
    <g class="actor chaser {o.cls}" transform="translate({o.x} {o.y}) scale({o.s})" style="--x:{o.x};--y:{o.y};--s:{o.s}">
      <g class="bob">
        {@render leg("b", "#1e242b")}
        {@render arm("b", "#2b323a", "#5a3820")}
        <rect x="-9" y="-78" width="18" height="34" rx="6" fill="#262c33" stroke="#4a545f" stroke-width="1" />
        <rect x="-9" y="-56" width="18" height="4" fill="#07080a" /><rect x="-2" y="-56" width="4" height="4" fill="#f2c14e" />
        <path d="M-6 -77 l0 8 M6 -77 l0 8" stroke="#4a545f" stroke-width="1.2" />
        <path d="M-3 -72 l2 -4 l2 4 l-4 -3 h4z" fill="#f2c14e" />
        <circle cx="4" cy="-90" r="11" fill="#5a3820" />
        <circle cx="9" cy="-92" r="1.6" fill="#fff" /><circle cx="9.5" cy="-92" r=".8" fill="#111" />
        <path d="M-8 -93 a12 12 0 0 1 24 0 z" fill="#14181d" stroke="#4a545f" stroke-width=".8" /><rect x="6" y="-96" width="14" height="4" rx="1.5" fill="#05060a" />
        <circle cx="3" cy="-98" r="2.2" fill="#f2c14e" />
        {@render leg("a", "#1e242b")}
        <g transform="translate(0 -76)"><g class="arm a">
          <line x1="0" y1="0" x2="0" y2="14" stroke="#2b323a" stroke-width="7" stroke-linecap="round" />
          <g transform="translate(0 14)"><g class="forearm">
            <line x1="0" y1="0" x2="0" y2="13" stroke="#5a3820" stroke-width="6" stroke-linecap="round" />
            {#if o.baton}<line x1="0" y1="12" x2="1" y2="-12" stroke="#05060a" stroke-width="4.5" stroke-linecap="round" /><line x1="0" y1="12" x2="0.4" y2="6" stroke="#f2c14e" stroke-width="4.6" stroke-linecap="round" />{/if}
          </g></g>
        </g></g>
      </g>
    </g>
  {/each}

  <g class="actor runner" transform="translate(374 372) scale(1.35)">
    <g class="bob fast">
      {@render leg("b", "#161616")}
      {@render arm("b", "url(#chase-stripes)", "#6b4226")}
      <g class="sack"><circle cx="-14" cy="-66" r="13" fill="#8b5a2b" /><path d="M-18 -78 l4 -6 l4 6z" fill="#6f451d" /><text x="-14" y="-61" text-anchor="middle" font-size="15" font-weight="800" fill="#f6f1e1" font-family="Arial, sans-serif">₦</text></g>
      <rect x="-9" y="-78" width="18" height="34" rx="6" fill="url(#chase-stripes)" />
      <circle cx="4" cy="-90" r="11" fill="#141414" />
      <rect x="4" y="-94" width="10" height="5" rx="2" fill="#6b4226" /><circle cx="9" cy="-91.5" r="1.4" fill="#fff" />
      {@render leg("a", "#161616")}
      <g transform="translate(0 -76)"><g class="arm a">
        <line x1="0" y1="0" x2="0" y2="14" stroke="url(#chase-stripes)" stroke-width="7" stroke-linecap="round" />
        <g transform="translate(0 14)"><g class="forearm"><line x1="0" y1="0" x2="0" y2="13" stroke="#6b4226" stroke-width="6" stroke-linecap="round" /></g></g>
      </g></g>
    </g>
  </g>
</svg>
