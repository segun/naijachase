<script lang="ts">
  let { name, size = 20 }: { name: string; size?: number } = $props();
  const paths: Record<string, string> = {
    overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    health: "M2 12h5l3-9 4 18 3-9h5",
    refresh: "M20 7v5h-5 M4 17v-5h5 M6.1 6.1a8 8 0 0 1 13.2 3 M4.7 14.9a8 8 0 0 0 13.2 3",
    arrow: "M7 17 17 7 M7 7h10v10",
    lock: "M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3",
    logout: "M9 21H4V3h5 M14 8l5 4-5 4 M8 12h11",
    clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    check: "M4 12l5 5L20 6",
    mail: "M3 5h18v14H3z M3 5l9 7 9-7",
    server: "M3 3h18v7H3z M3 14h18v7H3z M7 6h.01 M7 17h.01",
    info: "M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0"
  };
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.info} /></svg>
