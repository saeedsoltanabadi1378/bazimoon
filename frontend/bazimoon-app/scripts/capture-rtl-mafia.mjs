import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const output = process.env.RTL_OUTPUT || path.join(os.tmpdir(), "bazimoon-rtl-mafia");
fs.mkdirSync(output, { recursive: true });
const chromeCandidates = process.platform === "win32"
  ? ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"]
  : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
const chromePath = chromeCandidates.find(fs.existsSync);
if (!chromePath) throw new Error("Chrome or Chromium is required for RTL screenshots.");

const children = [];
function start(command, args, env = {}) {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: "ignore", windowsHide: true });
  children.push(child);
  return child;
}
const node = process.execPath;
start(node, ["scripts/rtl-mock.mjs"]);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this check through npm so npm_execpath is available.");
start(node, [npmCli, "run", "dev", "--", "--host", "127.0.0.1", "--port", "5174"], { VITE_API_BASE_URL: "http://127.0.0.1:5199" });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "bazimoon-chrome-"));
start(chromePath, ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=9225", `--user-data-dir=${profile}`, "about:blank"]);

async function waitFor(url) {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(url)).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

let socket;
try {
  await Promise.all([waitFor("http://127.0.0.1:5174"), waitFor("http://127.0.0.1:5199/api/hub/config"), waitFor("http://127.0.0.1:9225/json/version")]);
  const target = await fetch("http://127.0.0.1:9225/json/new", { method: "PUT" }).then((response) => response.json());
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  const captures = ["lobby", "night", "day", "voting", "defence", "results", "ended"];
  for (const route of captures) {
    await send("Page.navigate", { url: `http://127.0.0.1:5174/g/${route}?lang=fa` });
    await new Promise((resolve) => setTimeout(resolve, 1300));
    const check = await send("Runtime.evaluate", { expression: "({dir:document.documentElement.dir,lang:document.documentElement.lang,overflow:document.documentElement.scrollWidth-window.innerWidth})", returnByValue: true });
    const value = check.result.value;
    if (value.dir !== "rtl" || value.lang !== "fa") throw new Error(`${route}: expected fa/rtl, got ${JSON.stringify(value)}`);
    if (value.overflow > 2) throw new Error(`${route}: horizontal overflow of ${value.overflow}px`);
    const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    fs.writeFileSync(path.join(output, `${route}-fa.png`), Buffer.from(shot.data, "base64"));

    if (route === "lobby") {
      await send("Runtime.evaluate", { expression: "[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('امنیت بازیکن'))?.click()" });
      await new Promise((resolve) => setTimeout(resolve, 250));
      const safetyShot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      fs.writeFileSync(path.join(output, "player-safety-fa.png"), Buffer.from(safetyShot.data, "base64"));
    }
  }
  process.stdout.write(`Captured ${captures.length + 1} Persian RTL states in ${output}\n`);
} finally {
  socket?.close();
  for (const child of children.reverse()) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  } catch (error) {
    process.stderr.write(`Warning: could not remove temporary Chrome profile: ${error.message}\n`);
  }
}
