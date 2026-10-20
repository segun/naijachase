import type { AchievementDef } from "./model.ts";

export type ShareNetwork = "facebook" | "x" | "whatsapp" | "linkedin" | "telegram" | "reddit" | "bluesky";
export const SHARE_NETWORKS: { id: ShareNetwork; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "x", label: "X" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "telegram", label: "Telegram" },
  { id: "reddit", label: "Reddit" },
  { id: "bluesky", label: "Bluesky" }
];

export type AchievementSharePayload = { title: string; text: string; url: string };

export function achievementSharePayload(
  achievement: AchievementDef,
  investigator = "",
  origin = typeof location === "undefined" ? "https://naijachase.app" : location.origin
): AchievementSharePayload {
  const url = new URL("/", origin);
  url.searchParams.set("achievement", achievement.id);
  const name = investigator.trim() ? `${investigator.trim()} unlocked` : "I unlocked";
  return {
    title: `${achievement.title} · Naija Chase`,
    text: `${name} the “${achievement.title}” achievement in Naija Chase. ${achievement.description}`,
    url: url.toString()
  };
}

export function socialShareUrl(network: ShareNetwork, payload: AchievementSharePayload): string {
  const message = `${payload.text}\n${payload.url}`;
  const query = (base: string, values: Record<string, string>) => {
    const url = new URL(base);
    Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.toString();
  };
  switch (network) {
    case "facebook": return query("https://www.facebook.com/sharer/sharer.php", { u: payload.url });
    case "x": return query("https://twitter.com/intent/tweet", { text: payload.text, url: payload.url });
    case "whatsapp": return query("https://wa.me/", { text: message });
    case "linkedin": return query("https://www.linkedin.com/sharing/share-offsite/", { url: payload.url });
    case "telegram": return query("https://t.me/share/url", { url: payload.url, text: payload.text });
    case "reddit": return query("https://www.reddit.com/submit", { url: payload.url, title: payload.title });
    case "bluesky": return query("https://bsky.app/intent/compose", { text: message });
  }
}

function wrappedLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Generates the actual PNG attached by the native device share sheet. */
export async function achievementCardFile(achievement: AchievementDef, investigator = ""): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot draw the achievement image.");

  const gradient = context.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, "#061c17");
  gradient.addColorStop(1, "#103d31");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1200, 630);
  context.strokeStyle = "#3de6a1";
  context.lineWidth = 4;
  context.strokeRect(32, 32, 1136, 566);

  context.fillStyle = "#3de6a1";
  context.font = "700 30px system-ui, sans-serif";
  context.fillText("NAIJA CHASE", 80, 105);

  context.fillStyle = "#f4c64e";
  context.beginPath();
  context.arc(1035, 120, 58, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#061c17";
  context.font = "800 64px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("★", 1035, 142);
  context.textAlign = "left";

  context.fillStyle = "#f4c64e";
  context.font = "700 25px system-ui, sans-serif";
  context.fillText("ACHIEVEMENT UNLOCKED", 80, 190);
  context.fillStyle = "#fff8df";
  context.font = "800 68px system-ui, sans-serif";
  wrappedLines(context, achievement.title, 920).slice(0, 2).forEach((line, index) => context.fillText(line, 80, 285 + index * 78));

  context.fillStyle = "#c9ded6";
  context.font = "400 30px system-ui, sans-serif";
  const descriptionY = achievement.title.length > 26 ? 450 : 375;
  wrappedLines(context, achievement.description, 1000).slice(0, 3).forEach((line, index) => context.fillText(line, 80, descriptionY + index * 42));

  context.fillStyle = "#3de6a1";
  context.font = "600 25px system-ui, sans-serif";
  context.fillText(investigator.trim() || "Naija Chase investigator", 80, 555);
  context.textAlign = "right";
  context.fillText("naijachase.app", 1120, 555);

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("The achievement image could not be created.")), "image/png"));
  const safe = achievement.id.replace(/[^a-z0-9_-]/gi, "-");
  return new File([blob], `naijachase-${safe}.png`, { type: "image/png" });
}
