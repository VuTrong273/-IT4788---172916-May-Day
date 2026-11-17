const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const LOCAL_ENV_PATH = path.join(PROJECT_ROOT, ".env.local");
const VIRTUAL_INTERFACE = /virtual|vethernet|docker|wsl|vmware|vpn|loopback/i;
const WIRELESS_INTERFACE = /wi-?fi|wireless/i;

function getLanAddresses() {
  return Object.entries(os.networkInterfaces())
    .flatMap(([name, entries]) =>
      (entries || [])
        .filter(
          (entry) =>
            entry.family === "IPv4" &&
            !entry.internal &&
            !entry.address.startsWith("169.254.") &&
            !VIRTUAL_INTERFACE.test(name),
        )
        .map((entry) => ({ name, address: entry.address })),
    )
    .sort(
      (a, b) =>
        Number(WIRELESS_INTERFACE.test(b.name)) -
        Number(WIRELESS_INTERFACE.test(a.name)),
    );
}

function readSavedApiUrl() {
  if (!fs.existsSync(LOCAL_ENV_PATH)) return undefined;
  return fs
    .readFileSync(LOCAL_ENV_PATH, "utf8")
    .match(/^EXPO_PUBLIC_API_URL\s*=\s*["']?([^\s"']+)/m)?.[1];
}

function canReuseSavedUrl(saved, addresses) {
  if (!saved) return false;
  try {
    const url = new URL(saved);
    return (
      url.protocol === "https:" ||
      addresses.some((entry) => entry.address === url.hostname)
    );
  } catch {
    return false;
  }
}

function resolveApiUrl(addresses) {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const saved = readSavedApiUrl();
  if (canReuseSavedUrl(saved, addresses)) return saved;
  if (!addresses.length)
    throw new Error(
      "Không tìm thấy IPv4 LAN. Kết nối Wi-Fi hoặc đặt EXPO_PUBLIC_API_URL.",
    );
  return `http://${addresses[0].address}:3000/api/v1`;
}

async function checkBackend(apiUrl) {
  const url = new URL(apiUrl);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("EXPO_PUBLIC_API_URL phải là địa chỉ HTTP(S) hợp lệ.");
  }
  const health = await fetch(`${url.origin}/`, {
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!health?.ok) {
    throw new Error(
      `Không truy cập được backend tại ${url.origin}. Khởi động backend và kiểm tra API_BIND_HOST=0.0.0.0 khi dùng Docker trên máy này.`,
    );
  }
}

function startExpo(apiUrl) {
  const child = spawn(
    process.execPath,
    [
      require.resolve("expo/bin/cli"),
      "start",
      "--lan",
      "--clear",
      ...process.argv.slice(2),
    ],
    {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl },
    },
  );
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

async function main() {
  const apiUrl = resolveApiUrl(getLanAddresses());
  await checkBackend(apiUrl);
  console.log(`Mobile API: ${apiUrl}`);
  console.log("Điện thoại và máy tính cần cùng mạng Wi-Fi.");
  startExpo(apiUrl);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
