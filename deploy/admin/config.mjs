import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

export const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export function readEnv(file) {
  if (!fs.existsSync(file)) throw Error(`Configuration file is missing: ${file}`);
  return parseEnv(fs.readFileSync(file, "utf8"));
}
export function setupDirectory(requested) {
  const directory = path.resolve(requested);
  if (fs.existsSync(path.join(directory, "admin.env"))) return directory;
  const legacy = path.join(directory, "first-install");
  return fs.existsSync(path.join(legacy, "admin.env")) ? legacy : directory;
}
export function identifier(value, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(value ?? "")) throw Error(`${label} must contain only letters, digits and underscores.`);
  return value;
}
export function gameSettings(file) {
  const values = readEnv(file);
  for (const key of ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"]) {
    if (!values[key]) throw Error(`${key} is missing from the selected game configuration.`);
  }
  if (!/^[A-Za-z0-9_.:-]+$/.test(values.MYSQL_HOST)) throw Error("MYSQL_HOST is invalid.");
  identifier(values.MYSQL_DATABASE, "MYSQL_DATABASE");
  const port = Number(values.MYSQL_PORT ?? 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error("MYSQL_PORT is invalid.");
  const mode = values.MYSQL_SSL_MODE ?? "disabled";
  if (!["required", "verify_identity"].includes(mode)) throw Error("Production admin setup needs MYSQL_SSL_MODE=required or verify_identity; disabled is not accepted.");
  return { ...values, MYSQL_PORT: String(port), MYSQL_SSL_MODE: mode };
}
export function sqlString(value) {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}
export function privateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const actual = fs.realpathSync(directory);
  if (actual === repository || actual.startsWith(repository + path.sep)) throw Error("Admin secrets must stay outside the repository checkout.");
  fs.chmodSync(actual, 0o700);
  return actual;
}
export function writePrivateEnv(file, values, exclusive = false) {
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw Error("Refusing a symlink for admin.env.");
  const text = "# Private admin settings. Database secrets are generated; web login uses the bootstrap hash.\n" + Object.entries(values)
    .map(([key, value]) => {
      if (!/^[A-Z][A-Z0-9_]*$/.test(key) || /['\r\n]/.test(value)) throw Error(`Cannot safely write setting ${key}.`);
      return `${key}='${value}'`;
    }).join("\n") + "\n";
  if (exclusive) fs.writeFileSync(file, text, { mode: 0o600, flag: "wx" });
  else {
    const temporary = `${file}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporary, text, { mode: 0o600, flag: "wx" });
      fs.renameSync(temporary, file);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  fs.chmodSync(file, 0o600);
}
export function prepare(requested, source, hash) {
  const game = gameSettings(source);
  const directory = privateDirectory(setupDirectory(requested));
  const file = path.join(directory, "admin.env");
  const existing = fs.existsSync(file);
  const values = existing ? Object.fromEntries(Object.entries(readEnv(file)).filter(([key]) => key.startsWith("ADMIN_") || key === "RUST_LOG")) : {
    ADMIN_ENVIRONMENT: "production", ADMIN_BIND: "127.0.0.1:8081",
    ADMIN_PUBLIC_ORIGIN: "https://admin.naijachase.app", ADMIN_BOOTSTRAP_USERNAME: "admin",
    ADMIN_BOOTSTRAP_PASSWORD_HASH: hash, ADMIN_MYSQL_USER: "naijachase_admin",
    ADMIN_MYSQL_PASSWORD: randomBytes(32).toString("hex"),
    ADMIN_CONTROL_MYSQL_USER: "naijachase_admin_control",
    ADMIN_CONTROL_MYSQL_PASSWORD: randomBytes(32).toString("hex"),
    ADMIN_CONTROL_MYSQL_DATABASE: "naijachase_admin", ADMIN_DISK_PATH: "/",
    ADMIN_GAME_HEALTH_ENABLED: "false", ADMIN_BACKUP_MAX_AGE_HOURS: "24", RUST_LOG: "info,tower_http=warn",
  };
  if (!existing && !/^\$argon2id\$[^\r\n]+$/.test(hash ?? "")) throw Error("A valid Argon2id bootstrap password hash is required for new settings.");
  // Import connection settings, preserving the generated service secrets and
  // bootstrap state when resuming an earlier setup.
  Object.assign(values, { ADMIN_MYSQL_HOST: game.MYSQL_HOST, ADMIN_MYSQL_PORT: game.MYSQL_PORT,
    ADMIN_MYSQL_DATABASE: game.MYSQL_DATABASE, ADMIN_MYSQL_SSL_MODE: game.MYSQL_SSL_MODE });
  if (game.MYSQL_SSL_CA) values.ADMIN_MYSQL_SSL_CA = game.MYSQL_SSL_CA;
  identifier(values.ADMIN_CONTROL_MYSQL_DATABASE, "ADMIN_CONTROL_MYSQL_DATABASE");
  if (values.ADMIN_CONTROL_MYSQL_DATABASE === game.MYSQL_DATABASE) throw Error("The admin control database must differ from the game database.");
  for (const key of ["ADMIN_MYSQL_USER", "ADMIN_CONTROL_MYSQL_USER"]) identifier(values[key], key);
  for (const key of ["ADMIN_MYSQL_PASSWORD", "ADMIN_CONTROL_MYSQL_PASSWORD"]) {
    if (!values[key]) throw Error(`Existing ${key} is missing; setup will not silently replace a service password.`);
  }
  writePrivateEnv(file, values, !existing);
  console.log(existing ? "Reused existing admin credentials and imported the selected game's connection settings." : "Created private admin settings. Both database service passwords were generated automatically.");
  console.log(`Private settings: ${file}`);
  return { directory, file, values, game };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, directory, source] = process.argv.slice(2);
    if (mode === "resolve") console.log(path.join(setupDirectory(directory), "admin.env"));
    else if (mode === "check") {
      gameSettings(source);
      process.exitCode = fs.existsSync(path.join(setupDirectory(directory), "admin.env")) ? 0 : 10;
    } else if (mode === "prepare") {
      const existing = fs.existsSync(path.join(setupDirectory(directory), "admin.env"));
      prepare(directory, source, existing ? undefined : fs.readFileSync(0, "utf8").trim());
    } else throw Error("Unknown admin config command.");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
