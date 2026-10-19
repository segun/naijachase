import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { stripFinderFiles } from "../dev/asset-hygiene.mjs";

test("build cleanup strips nested Finder files and keeps assets", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nc-assets-"));
  try {
    fs.mkdirSync(path.join(root, "nested"));
    fs.writeFileSync(path.join(root, "nested", ".DS_Store"), "metadata");
    fs.writeFileSync(path.join(root, "nested", "model.glb"), "model");
    stripFinderFiles(root);
    assert.deepEqual(fs.readdirSync(path.join(root, "nested")), ["model.glb"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("Nginx serves CSP, safe cache headers and no Finder files", async t => {
  if (spawnSync("nginx", ["-v"]).error?.code === "ENOENT") { t.skip("Nginx is not installed"); return; }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nc-nginx-"));
  let child;
  const upstream = http.createServer((_request, response) => {
    response.setHeader("Cache-Control", "public, max-age=3600");
    response.end("{}");
  });
  try {
    await new Promise((resolve, reject) => { upstream.once("error", reject); upstream.listen(0, "127.0.0.1", resolve); });
    const reservation = net.createServer();
    await new Promise((resolve, reject) => { reservation.once("error", reject); reservation.listen(0, "127.0.0.1", resolve); });
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    const files = ["index.html", "assets/app-AbCd1234.js", "assets/plain.png", "assets/.DS_Store", "assets/3d/model.glb", "assets/3d/.DS_Store"];
    for (const file of files) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), "fixture");
    }
    const site = fs.readFileSync(new URL("../../deploy/nginx/naijachase.app.conf", import.meta.url), "utf8");
    let game = site.slice(site.lastIndexOf("\nserver {"));
    game = game.split("\n").filter(line => !/ssl_certificate|ssl_dhparam|include \/etc\/letsencrypt|listen /.test(line)).join("\n");
    game = game.replace("http://127.0.0.1:8080/", `http://127.0.0.1:${upstream.address().port}/`);
    game = game.replace("server {", `server {\n listen 127.0.0.1:${port};`).replace("root /var/www/naijachase.app;", `root ${root};`);
    const config = path.join(root, "nginx.conf");
    fs.writeFileSync(config, `pid ${root}/nginx.pid;\nerror_log ${root}/error.log;\nevents {}\nhttp { access_log off; ${game}\n}`);
    child = spawn("nginx", ["-e", `${root}/error.log`, "-p", root, "-c", config, "-g", "daemon off;"], { stdio: "ignore" });
    const exited = once(child, "exit");
    const url = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { await fetch(`${url}/index.html`); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 20)); }
      if (child.exitCode !== null) break;
    }
    assert.ok(ready, fs.existsSync(`${root}/error.log`) ? fs.readFileSync(`${root}/error.log`, "utf8") : "Nginx did not start");
    for (const [file, cache] of [
      ["/index.html", "no-store"], ["/case/one", "no-store"], ["/api/v1/example", "no-store"],
      ["/assets/app-AbCd1234.js", "immutable"], ["/assets/plain.png", "must-revalidate"],
      ["/assets/3d/model.glb", "must-revalidate"], ["/assets/3d/model.glb?v=0123456789abcdefabcd", "immutable"]
    ]) {
      const response = await fetch(url + file);
      assert.equal(response.status, 200, file);
      assert.ok(response.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"), file);
      assert.ok(response.headers.get("cache-control")?.includes(cache), file);
      if (file.startsWith("/api/")) assert.ok(response.headers.get("x-request-id"), "API correlation IDs survive header overrides");
    }
    for (const file of ["/assets/.DS_Store", "/assets/3d/.DS_Store", "/assets/app.js.map", "/assets/missing-AbCd1234.js"]) {
      const response = await fetch(url + file);
      assert.equal(response.status, 404, file);
      assert.ok(!response.headers.get("cache-control")?.includes("immutable"), file);
    }
    child.kill("SIGTERM");
    await exited;
    child = null;
  } finally {
    if (child && child.exitCode === null) { child.kill("SIGTERM"); await once(child, "exit").catch(() => {}); }
    await new Promise(resolve => upstream.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
