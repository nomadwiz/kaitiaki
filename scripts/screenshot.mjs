// Captures one interface page as a light-theme PNG: headless Chrome at
// 1440 px wide, or the width given, 2x device scale, cut to the page's content. Chrome's
// headless mode follows the operating system's colour scheme, so this drives
// it over the DevTools protocol to ask for light (evidence/README.md, #158).
//
// Usage, with the interface running (`npm run interface`):
//   node scripts/screenshot.mjs <out.png> '<url>' [width]
//   node scripts/screenshot.mjs evidence/week6/158-units-as-alice.png 'http://localhost:5173/?as=<alice>#/units'
//   node scripts/screenshot.mjs evidence/week6/176-home-375.png 'http://localhost:5173/?as=<alice>#/' 375
// Set CHROME to another Chrome or Chromium binary if it is not the macOS one.
// For a state an action brings about (#189): INIT is a script run before the
// page's own, such as a stand-in EIP-1193 wallet, and ACT an expression run
// once the log is read, such as a click, AFTER milliseconds (default 1500)
// before the capture, so a toast is still showing.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [out, url, width = "1440"] = process.argv.slice(2);
if (!out || !url) throw new Error("usage: screenshot.mjs <out.png> <url> [width]");
// Below 800 px the interface is the phone layout, so Chrome emulates a phone.
const mobile = Number(width) < 800;
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
    send("Emulation.setDeviceMetricsOverride", { width: Number(width), height, deviceScaleFactor: 2, mobile });

  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await size(mobile ? 812 : 900);
  await send("Page.enable");
  if (process.env.INIT) await send("Page.addScriptToEvaluateOnNewDocument", { source: process.env.INIT });
  await send("Page.navigate", { url });
  await sleep(6000); // the log replay
  if (process.env.ACT) {
    await send("Runtime.evaluate", { expression: process.env.ACT });
    await sleep(Number(process.env.AFTER ?? 1500));
  }
  // The lowest edge of any element, plus a margin: the page's own height is
  // never below the window's, which would leave an empty tail.
  const { result } = await send("Runtime.evaluate", {
    expression: `Math.ceil(Math.max(...[...document.body.querySelectorAll("*")].map((e) => e.getBoundingClientRect().bottom))) + 64`,
    returnByValue: true,
  });
  await size(result.value);
  await sleep(500);
  writeFileSync(out, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  console.log(`${out}: ${width} x ${result.value}`);
} finally {
  const exited = new Promise((r) => proc.once("exit", r));
  proc.kill();
  await Promise.race([exited, sleep(5000)]); // Chrome still writes to its profile until it exits
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
process.exit(0);
