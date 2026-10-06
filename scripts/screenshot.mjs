// Captures one interface page as a light-theme PNG: headless Chrome at
// 1440 px wide, 2x device scale, cut to the page's content. Chrome's
// headless mode follows the operating system's colour scheme, so this drives
// it over the DevTools protocol to ask for light (evidence/README.md, #158).
//
// Usage, with the interface running (`npm run interface`):
//   node scripts/screenshot.mjs <out.png> '<url>'
//   node scripts/screenshot.mjs evidence/week6/158-units-as-alice.png 'http://localhost:5173/?as=<alice>#/units'
// Set CHROME to another Chrome or Chromium binary if it is not the macOS one.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [out, url] = process.argv.slice(2);
if (!out || !url) throw new Error("usage: screenshot.mjs <out.png> <url>");
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9333 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "shot-"));
const proc = spawn(
  chrome,
  ["--headless=new", `--remote-debugging-port=${port}`, "--hide-scrollbars", `--user-data-dir=${profile}`, "about:blank"],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const within = (promise, what, ms = 15000) =>
  Promise.race([promise, sleep(ms).then(() => { throw new Error(`timed out: ${what}`); })]);

try {
  let tabs;
  for (let i = 0; !tabs && i < 50; i++) {
    tabs = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => undefined);
    if (!tabs) await sleep(200);
  }
  if (!tabs) throw new Error("Chrome did not start");
  const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  await within(new Promise((r) => (ws.onopen = r)), "connecting to Chrome");
  let n = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    pending.get(d.id)?.(d);
  };
  const send = async (method, params = {}) => {
    const id = ++n;
    const reply = await within(
      new Promise((r) => {
        pending.set(id, r);
        ws.send(JSON.stringify({ id, method, params }));
      }),
      method,
    );
    if (reply.error) throw new Error(`${method}: ${reply.error.message}`);
    return reply.result;
  };
  const size = (height) =>
    send("Emulation.setDeviceMetricsOverride", { width: 1440, height, deviceScaleFactor: 2, mobile: false });

  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await size(900);
  await send("Page.navigate", { url });
  await sleep(6000); // the log replay
  // The lowest edge of any element, plus a margin: the page's own height is
  // never below the window's, which would leave an empty tail.
  const { result } = await send("Runtime.evaluate", {
    expression: `Math.ceil(Math.max(...[...document.body.querySelectorAll("*")].map((e) => e.getBoundingClientRect().bottom))) + 64`,
    returnByValue: true,
  });
  await size(result.value);
  await sleep(500);
  writeFileSync(out, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  console.log(`${out}: 1440 x ${result.value}`);
} finally {
  const exited = new Promise((r) => proc.once("exit", r));
  proc.kill();
  await Promise.race([exited, sleep(5000)]); // Chrome still writes to its profile until it exits
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
process.exit(0);
