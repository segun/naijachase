import { spawn } from "node:child_process";

/** Start the mock API or reject promptly with its stderr when startup fails. */
export function startMockServer(root, port, timeoutMs = 5_000) {
  const child = spawn(process.execPath, ["dev/mock-api.mjs"], {
    cwd: new URL(".", root).pathname,
    env: { ...process.env, PORT: String(port) }
  });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });

  const ready = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (action, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action(value);
    };
    const failure = message => finish(reject, new Error(`${message}${stderr ? `:\n${stderr.trim()}` : ""}`));
    const timer = setTimeout(() => {
      child.kill();
      failure(`Mock API did not start within ${timeoutMs}ms`);
    }, timeoutMs);

    child.once("error", error => failure(`Mock API could not be spawned (${error.message})`));
    child.once("exit", (code, signal) => failure(`Mock API exited before startup (code ${code ?? "none"}, signal ${signal ?? "none"})`));
    child.stdout.once("data", () => finish(resolve, child));
  });

  return { child, ready };
}
