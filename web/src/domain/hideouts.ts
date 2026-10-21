/** Keep the server's order within each group; never imply which hideout is right. */
export function unsearchedFirst<T extends { id: string }>(hideouts: readonly T[], searched: ReadonlySet<string>): T[] {
  return [...hideouts].sort((a, b) => Number(searched.has(a.id)) - Number(searched.has(b.id)));
}
