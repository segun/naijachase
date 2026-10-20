import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { prepare, readEnv } from "./config.mjs";

const hash = "$argon2id$v=19$m=19456,t=2,p=1$YWJjZGVmZ2hpamtsbW5vcA$fXVb6z8id8LbrB8yKL+f5Bv9ZnBTtOCxb7CYp9bWQcs";
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "admin-setup-"));
  const game = path.join(root, "game.env"), directory = path.join(root, "private");
  fs.writeFileSync(game, "MYSQL_HOST=127.0.0.1\nMYSQL_PORT=23306\nMYSQL_USER=setup_owner\nMYSQL_PASSWORD='literal$()back`tick`'\nMYSQL_DATABASE=game_test\nMYSQL_SSL_MODE=required\n", { mode: 0o600 });
  return { root, game, directory, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}
test("dotenv import is data; prepared secrets and retired bootstrap omission survive resume", () => {
  const f = fixture();
  try {
    const original = prepare(f.directory, f.game, hash);
    assert.equal(readEnv(f.game).MYSQL_PASSWORD, "literal$()back`tick`");
    assert.equal(original.values.ADMIN_MYSQL_PORT, "23306");
    assert.equal(original.values.ADMIN_MYSQL_SSL_MODE, "required");
    const saved = original.values;
    delete saved.ADMIN_BOOTSTRAP_PASSWORD_HASH;
    fs.writeFileSync(original.file, Object.entries(saved).map(([key, value]) => `${key}='${value}'`).join("\n") + "\nMYSQL_PASSWORD='must-not-enter-runtime'\n");
    const resumed = prepare(f.directory, f.game);
    assert.equal(resumed.values.ADMIN_MYSQL_PASSWORD, original.values.ADMIN_MYSQL_PASSWORD);
    assert.equal(resumed.values.ADMIN_CONTROL_MYSQL_PASSWORD, original.values.ADMIN_CONTROL_MYSQL_PASSWORD);
    assert.equal(resumed.values.ADMIN_BOOTSTRAP_PASSWORD_HASH, undefined);
    assert.equal(readEnv(resumed.file).MYSQL_PASSWORD, undefined);
    assert.equal(fs.statSync(resumed.file).mode & 0o777, 0o600);
    const wrapper = spawnSync("bash", ["deploy/admin/prepare-config.sh", f.directory, "/missing/binary", f.game], { encoding: "utf8", input: "" });
    assert.equal(wrapper.status, 0, wrapper.stderr);
    assert.ok(!wrapper.stdout.includes(saved.ADMIN_MYSQL_PASSWORD));
  } finally { f.cleanup(); }
});

test("explicit provisioning resumes without rotations; collisions and bad config fail closed", () => {
  const f = fixture();
  try {
    const prepared = prepare(f.directory, f.game, hash);
    const stateFile = path.join(f.root, "state.json"), mysql = path.join(f.root, "mysql.mjs"), tools = path.join(f.root, "tools.mjs");
    fs.writeFileSync(stateFile, JSON.stringify({ schema: 22, control: false, users: {}, sql: [], migrations: 0 }));
    fs.writeFileSync(mysql, `#!/usr/bin/env node
import fs from 'node:fs';
const file=process.argv.find(v=>v.startsWith('--defaults-file=')).slice(16);
const config=Object.fromEntries(fs.readFileSync(file,'utf8').split('\\n').filter(v=>v.includes('=')).map(v=>{const i=v.indexOf('=');return [v.slice(0,i),v.slice(i+1).startsWith('"')?JSON.parse(v.slice(i+1)):v.slice(i+1)]}));
const state=JSON.parse(fs.readFileSync(process.env.ADMIN_TEST_STATE,'utf8'));
const sql=fs.readFileSync(0,'utf8').trim();
const account=state.users[config.user];
if(config.user!=='setup_owner'&&(!account||account.password!==config.password)){console.error('Access denied');process.exit(1)}
state.sql.push(sql);let output='';
if(sql==='SHOW GRANTS FOR CURRENT_USER')output="GRANT ALL PRIVILEGES ON *.* TO 'setup_owner'@'127.0.0.1' WITH GRANT OPTION";
else if(sql==='SELECT USER()')output='setup_owner@127.0.0.1';
else if(sql.includes('MAX(version)'))output=String(state.schema);
else if(sql.startsWith('SELECT COUNT(*) FROM information_schema.schemata'))output=state.control?'1':'0';
else if(sql.startsWith('CREATE DATABASE'))state.control=true;
else if(sql.startsWith('SELECT COUNT(*) FROM mysql.user')){const user=sql.match(/User='([^']+)'/)[1];output=state.users[user]?'1':'0'}
else if(sql.startsWith('CREATE USER')){const user=sql.match(/CREATE USER '([^']+)'/)[1];const password=sql.match(/IDENTIFIED BY '([^']+)'/)[1];state.users[user]={password,grants:[]}}
else if(sql.startsWith('GRANT ')){const grant=sql.replace(/\\s+/g,' ');const user=grant.match(/ TO '([^']+)'/)[1];if(!state.users[user].grants.includes(grant))state.users[user].grants.push(grant)}
else if(sql.startsWith('SHOW GRANTS FOR ')){const user=sql.match(/FOR '([^']+)'/)[1];output=["GRANT USAGE ON *.* TO '"+user+"'@'127.0.0.1'",...state.users[user].grants].join('\\n')}
else if(sql.startsWith('SELECT 1'))output='1';
fs.writeFileSync(process.env.ADMIN_TEST_STATE,JSON.stringify(state));if(output)console.log(output);
`, { mode: 0o755 });
    fs.writeFileSync(tools, `#!/usr/bin/env node
import fs from 'node:fs';
if(process.env.MYSQL_PASSWORD!=="literal$()back\u0060tick\u0060")process.exit(9);
const s=JSON.parse(fs.readFileSync(process.env.ADMIN_TEST_STATE,'utf8'));s.schema=23;s.migrations++;fs.writeFileSync(process.env.ADMIN_TEST_STATE,JSON.stringify(s));
`, { mode: 0o755 });
    const run = () => spawnSync(process.execPath, ["deploy/admin/provision.mjs", f.directory, f.game, f.game, tools], { encoding: "utf8", env: { ...process.env, ADMIN_MYSQL_BIN: mysql, ADMIN_TEST_STATE: stateFile } });
    let result = run();
    assert.equal(result.status, 0, result.stderr);
    const first = JSON.parse(fs.readFileSync(stateFile));
    assert.equal(first.migrations, 1);
    assert.equal(Object.keys(first.users).length, 2);
    assert.equal(first.users.naijachase_admin.password, prepared.values.ADMIN_MYSQL_PASSWORD);
    result = run(); assert.equal(result.status, 0, result.stderr);
    const resumed = JSON.parse(fs.readFileSync(stateFile));
    assert.equal(resumed.migrations, 1);
    assert.equal(resumed.sql.filter(sql => sql.startsWith("CREATE USER")).length, 2);
    assert.ok(!resumed.sql.some(sql => /^ALTER USER|^DROP USER/.test(sql)));
    resumed.users.naijachase_admin.password = "different-existing-secret";
    fs.writeFileSync(stateFile, JSON.stringify(resumed));
    result = run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /will not reset its password/);
    assert.ok(!result.stderr.includes(prepared.values.ADMIN_MYSQL_PASSWORD));
    const original = fs.readFileSync(prepared.file, "utf8");
    fs.appendFileSync(prepared.file, "ADMIN_CONTROL_MYSQL_HOST='different.invalid'\n");
    const before = fs.readFileSync(stateFile, "utf8");
    result = run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /one-server setup helper/);
    assert.equal(fs.readFileSync(stateFile, "utf8"), before);
    fs.writeFileSync(prepared.file, original.replace(prepared.values.ADMIN_MYSQL_PASSWORD, "custom-secret"));
    result = run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /generated format/);
    assert.equal(fs.readFileSync(stateFile, "utf8"), before);
  } finally { f.cleanup(); }
});
