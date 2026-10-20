<script lang="ts">
  const PATHS: Record<string, string> = {
    menu: "M4 6h16 M4 12h16 M4 18h16",
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.3-4.3",
    notebook: "M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z M6 3v18 M10 8h6 M10 12h6",
    id: "M3 5h18v14H3z M9 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M6 16.5c.8-2 4.2-2 5 0 M14 9h4 M14 13h4",
    plane: "M22 2L11 13 M22 2l-7 20-4-9-9-4z",
    warrant: "M7 3h8l4 4v14H7z M15 3v4h4 M10 14l2 2 4-4",
    sliders: "M4 6h9 M17 6h3 M4 12h3 M11 12h9 M4 18h11 M19 18h1 M15 4v4 M9 10v4 M17 16v4",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2",
    star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
    logout: "M9 21H5V3h4 M16 17l5-5-5-5 M21 12H9",
    pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    market: "M3 9l2-5h14l2 5 M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0 M5 12v8h14v-8",
    library: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 21V5 M9 8h6",
    park: "M5 4h14a1 1 0 0 1 1 1v11H4V5a1 1 0 0 1 1-1z M4 11h16 M7 19v2 M17 19v2 M7.5 15h.01 M16.5 15h.01",
    check: "M5 12.5l4.5 4.5L19 7.5",
    x: "M6 6l12 12 M18 6L6 18",
    sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4",
    moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z",
    home: "M3 11l9-8 9 8 M5 10v10h14V10 M10 20v-6h4v6",
    list: "M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01",
    map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z M9 4v14 M15 6v14",
    alert: "M12 3l10 18H2z M12 10v4 M12 17.5h.01",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    chat: "M4 5h16v11H9l-5 4z",
    trophy: "M7 4h10v5a5 5 0 0 1-10 0z M7 6H4v2a3 3 0 0 0 3 3 M17 6h3v2a3 3 0 0 1-3 3 M12 14v4 M8 21h8",
    shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    lock: "M6 11h12v10H6z M8 11V8a4 4 0 0 1 8 0v3",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 4-6 8-6s8 2 8 6",
    pencil: "M4 20l1-4L16 5l3 3L8 19z",
    archive: "M3 5h18v4H3z M5 9v10h14V9 M10 13h4",
    music: "M9 18V5l11-2v13 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
    mute: "M11 5L6 9H3v6h3l5 4z M22 9l-6 6 M16 9l6 6",
    car: "M5 16l1.5-5a2 2 0 0 1 1.9-1.4h7.2a2 2 0 0 1 1.9 1.4L19 16 M4 16h16v3h-2.5v-1.5h-11V19H4z M7.5 13.5h.01 M16.5 13.5h.01",
    thumb: "M7 11v9H4v-9z M7 11l4-7a2 2 0 0 1 2 2.2L12.6 9H18a2 2 0 0 1 2 2.4l-1.2 6.4a2 2 0 0 1-2 1.6H7",
    ledger: "M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h3",
    bell: "M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z M10 21h4",
    users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5 M17 11a3 3 0 1 0 0-6 M18.5 14.7c2 .6 3 2.2 3 4.3",
    flag: "M5 21V4 M5 4h11l-2 4 2 4H5",
    helper: "M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z",
    trophy2: "M7 4h10v5a5 5 0 0 1-10 0z M12 14v4 M8 21h8",
    mail: "M3 5h18v14H3z M3 6l9 7 9-7",
    flame: "M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z",
    info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v6 M12 7.5h.01",
    snow: "M12 2v20 M3.3 7l17.4 10 M3.3 17L20.7 7 M9.5 4L12 6.5 14.5 4 M9.5 20l2.5-2.5 2.5 2.5"
  };
  let { name, label }: { name: string; label?: string } = $props();
</script>

<svg class="icon" viewBox="0 0 24 24" aria-hidden={label ? undefined : "true"} role={label ? "img" : undefined} aria-label={label}>
  <path d={PATHS[name] ?? ""} />
</svg>
