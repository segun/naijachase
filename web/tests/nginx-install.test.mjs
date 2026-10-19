import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

for (const mode of ["success", "syntax", "duplicate", "reload"]) {
  test(`Nginx site reconciliation: ${mode}`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "nc-install-"));
    try {
      const available = path.join(root, "sites-available"), enabled = path.join(root, "sites-enabled");
      fs.mkdirSync(available); fs.mkdirSync(enabled);
      const game = path.join(available, "004-naijachase.app"), landing = path.join(available, "003-naijachase.com");
      const gameLink = path.join(enabled, "004-naijachase.app"), landingLink = path.join(enabled, "003-naijachase.com"), legacy = path.join(enabled, "004-naijachase.com");
      fs.writeFileSync(game, "old game");
      fs.writeFileSync(landing, "old landing");
      fs.symlinkSync("../sites-available/004-naijachase.app", gameLink);
      fs.symlinkSync("../sites-available/003-naijachase.com", landingLink);
      fs.symlinkSync("../sites-available/004-naijachase.com", legacy);
      fs.writeFileSync(path.join(enabled, "unrelated"), "untouched");
      const nginx = path.join(root, "nginx"), systemctl = path.join(root, "systemctl");
      fs.writeFileSync(nginx, '#!/bin/sh\ncase "$TEST_MODE" in syntax) echo "bad configuration"; exit 1;; duplicate) echo "conflicting server name";; *) echo "configuration test successful";; esac\n', { mode: 0o755 });
      fs.writeFileSync(systemctl, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$TEST_RELOAD_LOG"\n[ "$TEST_MODE" != reload ]\n', { mode: 0o755 });
      const result = spawnSync("sh", [new URL("../../deploy/nginx/install-sites.sh", import.meta.url).pathname, game, gameLink, landing, landingLink], {
        encoding: "utf8", env: { ...process.env, NGINX_BIN: nginx, SYSTEMCTL_BIN: systemctl, TEST_MODE: mode, TEST_RELOAD_LOG: path.join(root, "reload.log") }
      });
      assert.equal(fs.readFileSync(path.join(enabled, "unrelated"), "utf8"), "untouched");
      if (mode === "success") {
        assert.equal(result.status, 0, result.stderr);
        assert.match(fs.readFileSync(game, "utf8"), /server_name naijachase.app/);
        assert.match(fs.readFileSync(landing, "utf8"), /server_name naijachase.com/);
        assert.equal(fs.existsSync(legacy), false);
        assert.equal(fs.readdirSync(enabled).length, 3);
        assert.match(fs.readFileSync(path.join(root, "reload.log"), "utf8"), /reload nginx/);
      } else {
        assert.notEqual(result.status, 0);
        assert.equal(fs.readFileSync(game, "utf8"), "old game");
        assert.equal(fs.readFileSync(landing, "utf8"), "old landing");
        assert.equal(fs.readlinkSync(gameLink), "../sites-available/004-naijachase.app");
        assert.equal(fs.readlinkSync(legacy), "../sites-available/004-naijachase.com");
        if (mode !== "reload") assert.equal(fs.existsSync(path.join(root, "reload.log")), false);
      }
      assert.ok(fs.readdirSync(root).some(name => name.startsWith("naijachase-nginx-backup.")));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}
