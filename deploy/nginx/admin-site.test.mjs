import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { removeAdminServers } from "./extract-admin-default.mjs";

const stock = '# server { commented example }\nserver { listen 80 default_server; server_name _; location / { try_files $uri =404; } }\n';
const admin = 'server { server_name admin.naijachase.app; location / { add_header X-Test "# }"; } listen 443 ssl; }\nserver { if ($host = admin.naijachase.app) { return 301 https://$host$request_uri; } server_name admin.naijachase.app; listen 80; }';
test("removes both Certbot blocks and preserves default and unrelated servers", () => {
  const other = '\nserver { server_name another.example; listen 443 ssl; }\n';
  const result = removeAdminServers(stock + admin + other);
  assert.equal(result.count, 2);
  assert.equal(result.text, stock + '\n' + other);
  assert.throws(() => removeAdminServers(stock), /No admin server/);
  assert.throws(() => removeAdminServers('server { server_name admin.naijachase.app other.example; }'), /another hostname/);
  assert.throws(() => removeAdminServers('server { server_name admin.naijachase.app;'), /Unclosed/);
});

for (const failure of ["none", "validation", "reload", "changed-original"]) {
  test(`site move ${failure}: validates both files together and preserves rollback`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "admin-nginx-move-"));
    try {
      const available = path.join(directory, "sites-available"), enabled = path.join(directory, "sites-enabled");
      fs.mkdirSync(available); fs.mkdirSync(enabled);
      const site = path.join(available, "005-admin"), link = path.join(enabled, "005-admin");
      const legacy = path.join(available, "default"), original = path.join(directory, "original"), cleaned = path.join(directory, "cleaned"), source = path.join(directory, "source");
      fs.writeFileSync(site, "previous admin site\n"); fs.symlinkSync(site, link);
      fs.writeFileSync(legacy, stock + admin); fs.copyFileSync(legacy, original);
      fs.writeFileSync(cleaned, removeAdminServers(stock + admin).text); fs.writeFileSync(source, "new admin site\n");
      if (failure === "changed-original") fs.appendFileSync(legacy, "# changed\n");
      const before = fs.readFileSync(legacy, "utf8");
      const nginx = path.join(directory, "nginx"), systemctl = path.join(directory, "systemctl");
      fs.writeFileSync(nginx, '#!/bin/sh\n[ "$TEST_FAILURE" != validation ]\n', { mode: 0o755 });
      fs.writeFileSync(systemctl, '#!/bin/sh\n[ "$TEST_FAILURE" != reload ]\n', { mode: 0o755 });
      const result = spawnSync("sh", ["deploy/nginx/install-admin-site.sh", source, site, link, legacy, original, cleaned], {
        encoding: "utf8", env: { ...process.env, NGINX_BIN: nginx, SYSTEMCTL_BIN: systemctl, TEST_FAILURE: failure },
      });
      assert.equal(fs.readlinkSync(link), site);
      if (failure === "none") {
        assert.equal(result.status, 0, result.stderr);
        assert.equal(fs.readFileSync(legacy, "utf8"), removeAdminServers(stock + admin).text);
        assert.equal(fs.readFileSync(site, "utf8"), "new admin site\n");
      } else {
        assert.notEqual(result.status, 0);
        assert.equal(fs.readFileSync(legacy, "utf8"), before);
        assert.equal(fs.readFileSync(site, "utf8"), "previous admin site\n");
      }
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
}
