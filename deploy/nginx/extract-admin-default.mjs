import fs from "node:fs";
import { pathToFileURL } from "node:url";

// Token positions let us remove whole server blocks while preserving other
// hosts, comments and the default server byte for byte.
export function removeAdminServers(text) {
  const tokens = [...text.matchAll(/#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[{};]|[^\s{};#"']+/g)]
    .filter(token => !token[0].startsWith("#"));
  const removed = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i][0] !== "server" || tokens[i + 1]?.[0] !== "{") continue;
    const start = tokens[i].index;
    let depth = 1, names = [];
    i += 2;
    for (; i < tokens.length && depth; i++) {
      const word = tokens[i][0];
      if (word === "{") depth++;
      else if (word === "}") depth--;
      else if (depth === 1 && word === "server_name") {
        for (i++; i < tokens.length && tokens[i][0] !== ";"; i++) {
          names.push(tokens[i][0].replace(/^(['"])(.*)\1$/, "$2"));
        }
      }
    }
    if (depth) throw Error("Unclosed server block; default file was not changed.");
    if (names.includes("admin.naijachase.app")) {
      if (names.some(name => name !== "admin.naijachase.app")) {
        throw Error("An admin server block also serves another hostname; split it manually.");
      }
      removed.push([start, tokens[i - 1].index + 1]);
    }
    i--;
  }
  if (!removed.length) throw Error("No admin server blocks found in default; no files changed.");
  for (const [start, end] of removed.reverse()) text = text.slice(0, start) + text.slice(end);
  return { text, count: removed.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = removeAdminServers(fs.readFileSync(process.argv[2], "utf8"));
    fs.writeFileSync(process.argv[3], result.text, { mode: 0o600, flag: "wx" });
    console.log(`Prepared removal of ${result.count} admin server blocks from default.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
