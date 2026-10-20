import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
for (const failure of ["none", "validation", "reload", "duplicate", "http-downgrade"]) {
  test(`admin site install ${failure}: preserves the active site on failure`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "admin-nginx-install-"));
    try {
      const available = path.join(directory, "sites-available"), enabled = path.join(directory, "sites-enabled");
      fs.mkdirSync(available); fs.mkdirSync(enabled);
      const site = path.join(available, "005-admin"), link = path.join(enabled, "005-admin");
      const source = path.join(directory, failure === "http-downgrade" ? "admin.http.conf" : "source");
      fs.writeFileSync(site, "previous admin site\n"); fs.symlinkSync(site, link);
      fs.writeFileSync(source, "new admin site\n");
      const nginx = path.join(directory, "nginx"), systemctl = path.join(directory, "systemctl");
      fs.writeFileSync(nginx, '#!/bin/sh\nif [ "$TEST_FAILURE" = duplicate ]; then echo "conflicting server name"; fi\n[ "$TEST_FAILURE" != validation ]\n', { mode: 0o755 });
      fs.writeFileSync(systemctl, '#!/bin/sh\n[ "$TEST_FAILURE" != reload ]\n', { mode: 0o755 });
      const result = spawnSync("sh", ["deploy/nginx/install-admin-site.sh", source, site, link], {
        encoding: "utf8", env: { ...process.env, NGINX_BIN: nginx, SYSTEMCTL_BIN: systemctl, TEST_FAILURE: failure },
      });
      assert.equal(fs.readlinkSync(link), site);
      if (failure === "none") {
        assert.equal(result.status, 0, result.stderr);
        assert.equal(fs.readFileSync(site, "utf8"), "new admin site\n");
      } else {
        assert.notEqual(result.status, 0);
        assert.equal(fs.readFileSync(site, "utf8"), "previous admin site\n");
      }
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
}
