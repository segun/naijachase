// Explicit database setup command. It is never called by the running services.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { prepare, readEnv, repository, sqlString } from "./config.mjs";

const [requested, gameFile, credentialFile, tools] = process.argv.slice(2);
let temporary;
const secrets = new Set();
const redact = text => [...secrets].reduce((result, value) => value ? result.replaceAll(value, "[redacted]") : result, text);
function fail(message) { throw Error(redact(message)); }
function answer(prompt, hidden = false) {
  const script = `IFS= read -r ${hidden ? "-s " : ""}-p "$1" answer </dev/tty || exit 1; ${hidden ? "printf '\\n' >/dev/tty; " : ""}printf '%s' "$answer"`;
  const result = spawnSync("bash", ["-c", script, "admin-setup", prompt], { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] });
  if (result.status !== 0) fail("Interactive DBA input needs a terminal. Alternatively pass ADMIN_DB_ENV_FILE=/private/dba.env with MYSQL_USER and MYSQL_PASSWORD.");
  return result.stdout;
}
function option(value) { return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n").replaceAll("\r", "\\r")}"`; }
let sequence = 0;
function client(connection, user, password) {
  secrets.add(password);
  const file = path.join(temporary, `client-${++sequence}.cnf`);
  const lines = ["[client]", `host=${option(connection.host)}`, `port=${connection.port}`, `user=${option(user)}`, `password=${option(password)}`, "protocol=tcp",
    `ssl-mode=${connection.mode === "verify_identity" ? "VERIFY_IDENTITY" : "REQUIRED"}`];
  if (connection.mode === "verify_identity" && connection.ca) lines.push(`ssl-ca=${option(connection.ca)}`);
  fs.writeFileSync(file, lines.join("\n") + "\n", { mode: 0o600, flag: "wx" });
  return (sql, database, phase = "Database query") => {
    const env = { ...process.env }; delete env.MYSQL_PWD; delete env.MYSQL_TEST_LOGIN_FILE;
    const result = spawnSync(process.env.ADMIN_MYSQL_BIN ?? "mysql", [`--defaults-file=${file}`, "--no-login-paths", "--batch", "--skip-column-names", ...(database ? [database] : [])],
      { input: sql, encoding: "utf8", env, maxBuffer: 16 * 1024 * 1024 });
    if (result.error) fail(`${phase}: cannot run the MySQL 8 client (${result.error.message}).`);
    if (result.status !== 0) fail(`${phase} failed:\n${result.stderr.trim()}`);
    return result.stdout.trim();
  };
}
function canProvision(grants) {
  const global = grants.split("\n").filter(line => / ON \*\.\* TO /i.test(line));
  const privilege = name => global.some(line => /^GRANT ALL PRIVILEGES /i.test(line) || line.slice(6, line.indexOf(" ON ")).split(",").some(value => value.trim() === name));
  return ["CREATE USER", "CREATE", "CREATE VIEW", "CREATE ROUTINE", "ALTER ROUTINE", "SELECT", "INSERT", "UPDATE", "DELETE", "EXECUTE"].every(privilege)
    && global.some(line => / WITH GRANT OPTION/i.test(line));
}
function statements(sql) { return sql.replace(/^\s*--.*$/gm, "").split(";").map(value => value.trim()).filter(Boolean); }
function grantMap(sql) {
  const result = new Map();
  for (const statement of statements(sql)) {
    const match = statement.replace(/\s+/g, " ").match(/^GRANT (.+?) ON (.+?) TO /i);
    if (match) result.set(match[2].replaceAll("`", "").toLowerCase(), new Set(match[1].split(",").map(value => value.trim().toUpperCase())));
  }
  return result;
}
function assertRestricted(grants, expected) {
  for (const line of grants.split("\n")) {
    const match = line.match(/^GRANT (.+?) ON (.+?) TO /i);
    if (!match || / WITH GRANT OPTION/i.test(line)) fail("An existing admin principal has unexpected roles/grant authority. Have the DBA review its grants; setup will not silently revoke or reuse broad privileges.");
    const privileges = match[1].split(",").map(value => value.trim().toUpperCase());
    if (privileges.length === 1 && privileges[0] === "USAGE") continue;
    const allowed = expected.get(match[2].replaceAll("`", "").toLowerCase());
    if (!allowed || privileges.some(value => !allowed.has(value))) fail("An existing admin principal has broader access than this application's contract. Have the DBA review it before retrying.");
  }
}
try {
  if (!fs.existsSync(tools)) fail("The release migration tool is missing. Run make admin-build first.");
  const { directory, file, values: admin, game } = prepare(requested, gameFile);
  secrets.add(game.MYSQL_PASSWORD); secrets.add(admin.ADMIN_MYSQL_PASSWORD); secrets.add(admin.ADMIN_CONTROL_MYSQL_PASSWORD);
  if (![admin.ADMIN_MYSQL_PASSWORD, admin.ADMIN_CONTROL_MYSQL_PASSWORD].every(value => /^[0-9a-f]{64}$/.test(value))) fail("Prepared service passwords do not have the generated format; ask the DBA to provision these custom credentials manually. Setup will not replace them or change the database.");
  if (admin.ADMIN_MYSQL_USER === admin.ADMIN_CONTROL_MYSQL_USER || [admin.ADMIN_MYSQL_USER, admin.ADMIN_CONTROL_MYSQL_USER].includes(game.MYSQL_USER)) fail("Reporting, control and game usernames must be separate; no database changes were made.");
  for (const [key, expected] of [["ADMIN_CONTROL_MYSQL_HOST", game.MYSQL_HOST], ["ADMIN_CONTROL_MYSQL_PORT", game.MYSQL_PORT], ["ADMIN_CONTROL_MYSQL_SSL_MODE", game.MYSQL_SSL_MODE], ["ADMIN_CONTROL_MYSQL_SSL_CA", admin.ADMIN_MYSQL_SSL_CA ?? ""]]) {
    if (admin[key] && admin[key] !== expected) fail(`This one-server setup helper cannot apply a different ${key}. Align it with the imported game connection or have the DBA provision the custom control connection separately; no database changes were made.`);
  }
  temporary = fs.mkdtempSync(path.join(directory, ".provision-")); fs.chmodSync(temporary, 0o700);
  const connection = { host: game.MYSQL_HOST, port: game.MYSQL_PORT, mode: game.MYSQL_SSL_MODE, ca: game.MYSQL_SSL_CA };
  let credentials = { user: game.MYSQL_USER, password: game.MYSQL_PASSWORD };
  if (credentialFile && path.resolve(credentialFile) !== path.resolve(gameFile)) {
    const selected = readEnv(credentialFile);
    if (!selected.MYSQL_USER || !selected.MYSQL_PASSWORD) fail("The selected DBA env needs MYSQL_USER and MYSQL_PASSWORD.");
    for (const key of ["MYSQL_HOST", "MYSQL_PORT", "MYSQL_DATABASE"]) if (selected[key] && selected[key] !== game[key]) fail("The selected DBA env points to a different database connection than the game env.");
    credentials = { user: selected.MYSQL_USER, password: selected.MYSQL_PASSWORD };
  }
  let query = client(connection, credentials.user, credentials.password);
  console.log("Checking the selected database connection and setup permissions before any schema changes.");
  query("SELECT 1", game.MYSQL_DATABASE, "Connection preflight");
  if (!canProvision(query("SHOW GRANTS FOR CURRENT_USER", undefined, "Privilege preflight"))) {
    console.log("The selected game account cannot create the separate admin schema/users or grant their permissions.");
    console.log("Enter a DBA login once for setup. It will not be saved in the admin service configuration.");
    credentials = { user: answer("DBA username: "), password: answer("DBA password: ", true) };
    if (!credentials.user || !credentials.password) fail("A DBA username and password are required to provision separate service users.");
    query = client(connection, credentials.user, credentials.password);
    if (!canProvision(query("SHOW GRANTS FOR CURRENT_USER", undefined, "DBA privilege preflight"))) fail("That account still lacks user/grant and schema setup privileges. Ask the database owner for a provisioning account; no passwords were changed.");
  }
  const who = query("SELECT USER()", undefined, "Client identity preflight");
  const host = who.slice(who.lastIndexOf("@") + 1);
  if (!/^[A-Za-z0-9_.:-]+$/.test(host)) fail("MySQL returned an unsupported client-host identity; have the DBA scope the service grants explicitly.");
  const current = Number(query("SELECT COALESCE(MAX(version),0) FROM schema_migrations", game.MYSQL_DATABASE, "Schema version preflight"));
  const target = Number(fs.readFileSync(path.join(repository, "rust/crates/naijachase-storage/src/lib.rs"), "utf8").match(/pub const SCHEMA_VERSION: u32 = (\d+)/)?.[1]);
  if (!Number.isInteger(current) || !Number.isInteger(target) || current > target) fail("The selected game schema does not match this source release. Stop and review the release before provisioning.");
  if (current < target && game.MYSQL_SSL_MODE === "verify_identity") fail("The current game migration tool supports MYSQL_SSL_MODE=required, not verify_identity. No migration was started and strict verification was not weakened. Apply the pending game migration through a verified DBA connection or use a compatible migration tool, then resume admin setup.");
  console.log(`Preflight passed. Applying pending game migrations (current ${current}, target ${target}), then the separate admin schema and restricted grants.`);
  if (current < target) {
    const empty = path.join(temporary, "selected-migration.env"); fs.writeFileSync(empty, "# Selected connection values are passed directly to the child process.\n", { mode: 0o600 });
    const env = { ...process.env, ...Object.fromEntries(Object.entries(game).filter(([key]) => key.startsWith("MYSQL_"))), MYSQL_USER: credentials.user, MYSQL_PASSWORD: credentials.password,
      MYSQL_READ_TIMEOUT_MS: "240000", MYSQL_WRITE_TIMEOUT_MS: "240000", NAIJACHASE_ENV_FILE: empty };
    const migrated = spawnSync(path.resolve(tools), ["migrate-mysql"], { encoding: "utf8", env, cwd: repository, maxBuffer: 16 * 1024 * 1024 });
    if (migrated.error || migrated.status !== 0) fail(`Direct game migration failed:\n${migrated.error?.message ?? migrated.stderr.trim()}`);
    if (Number(query("SELECT COALESCE(MAX(version),0) FROM schema_migrations", game.MYSQL_DATABASE)) !== target) fail("The migration binary did not reach this release's schema. Rebuild the current release tools and retry.");
    console.log("Game migrations completed.");
  }
  const control = admin.ADMIN_CONTROL_MYSQL_DATABASE;
  if (query(`SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name=${sqlString(control)}`) === "0") query(`CREATE DATABASE \`${control}\` CHARACTER SET utf8mb4`, undefined, "Create admin control schema");
  for (const migration of ["0001_staff.sql", "0002_operations.sql"]) query(fs.readFileSync(path.join(repository, "admin/backend/migrations", migration), "utf8"), control, `Admin migration ${migration}`);
  for (const [template, user, password, checkDatabase, checkTable] of [
    ["admin-grants.sql", admin.ADMIN_MYSQL_USER, admin.ADMIN_MYSQL_PASSWORD, game.MYSQL_DATABASE, "admin_reporting_accounts_v1"],
    ["admin-control-grants.sql", admin.ADMIN_CONTROL_MYSQL_USER, admin.ADMIN_CONTROL_MYSQL_PASSWORD, control, "admin_staff"],
  ]) {
    const replacements = { GAME_DATABASE: game.MYSQL_DATABASE, CONTROL_DATABASE: control, CLIENT_HOST: host, REPORTING_PASSWORD: admin.ADMIN_MYSQL_PASSWORD, CONTROL_PASSWORD: admin.ADMIN_CONTROL_MYSQL_PASSWORD };
    let rendered = fs.readFileSync(path.join(repository, "deploy/mysql", template), "utf8").replace(/@@([A-Z_]+)@@/g, (_match, name) => replacements[name]);
    rendered = rendered.replaceAll("'naijachase_admin'", sqlString(admin.ADMIN_MYSQL_USER)).replaceAll("'naijachase_admin_control'", sqlString(admin.ADMIN_CONTROL_MYSQL_USER));
    const principal = `${sqlString(user)}@${sqlString(host)}`;
    const exists = query(`SELECT COUNT(*) FROM mysql.user WHERE User=${sqlString(user)} AND Host=${sqlString(host)}`) !== "0";
    const runtime = client(connection, user, password);
    if (exists) {
      try { runtime("SELECT 1", undefined, "Existing service credential check"); }
      catch { fail("An admin database user already exists but does not match the prepared secret. Reuse its original admin.env or ask the DBA to resolve that collision; setup will not reset its password."); }
      assertRestricted(query(`SHOW GRANTS FOR ${principal}`), grantMap(rendered));
    } else {
      const create = statements(rendered).find(statement => /^CREATE USER /i.test(statement));
      query(create, undefined, "Create restricted admin service user");
    }
    for (const statement of statements(rendered).filter(statement => /^GRANT /i.test(statement))) query(statement, undefined, "Apply restricted admin grants");
    runtime(`SELECT 1 FROM \`${checkTable}\` LIMIT 1`, checkDatabase, "Restricted service connection check");
    assertRestricted(query(`SHOW GRANTS FOR ${principal}`), grantMap(rendered));
  }
  console.log("Admin database setup completed. Existing staff, bootstrap retirement and generated service passwords were preserved.");
  console.log(`The final private service configuration is ready: ${file}`);
  console.log("Next: make admin-install-config admin-install-bundle admin-install-service admin-start");
} catch (error) { console.error(redact(error.message)); process.exitCode = 1; }
finally { if (temporary) fs.rmSync(temporary, { recursive: true, force: true }); }
