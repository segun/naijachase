/** @param {number | null | undefined} value */
export function count(value) { return value == null || !Number.isFinite(value) ? "Unavailable" : new Intl.NumberFormat("en-GB").format(value); }
/** @param {number | null | undefined} value */
export function bytes(value) {
  if (value == null || !Number.isFinite(value) || value < 0) return "Unavailable";
  if (value === 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: index < 2 ? 0 : 1 }).format(value / 1024 ** index)} ${units[index]}`;
}
/** @param {string | null | undefined} value */
export function utc(value) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(parsed) + " UTC";
}
/** @param {number | null | undefined} value */
export function duration(value) {
  if (value == null || !Number.isFinite(value) || value < 0) return "Unavailable";
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return days ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;
}
/** @param {number | null | undefined} total @param {number | null | undefined} available */
export function usedPercent(total, available) {
  if (total == null || available == null || total <= 0 || !Number.isFinite(total) || !Number.isFinite(available)) return null;
  return Math.min(100, Math.max(0, ((total - available) / total) * 100));
}
/** @param {number | null | undefined} completed @param {number | null | undefined} started */
export function percentage(completed, started) {
  if (completed == null || started == null || started <= 0) return "—";
  return `${Math.round(completed / started * 100)}%`;
}
/** @param {number[]} values @param {number} max @param {number} [width] @param {number} [height] */
export function chartPoints(values, max, width = 800, height = 180) {
  return values.map((value, index) => `${values.length <= 1 ? width / 2 : index / (values.length - 1) * width},${height - Math.max(0, value) / Math.max(1, max) * height}`).join(" ");
}
