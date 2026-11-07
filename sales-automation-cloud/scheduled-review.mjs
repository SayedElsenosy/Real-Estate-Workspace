import { appendFile } from "node:fs/promises";
import { createDecipheriv } from "node:crypto";

const summary = process.env.GITHUB_STEP_SUMMARY;
const status = (value) => {
  console.log("ELAF scheduled audit:", value);
  return summary ? appendFile(summary, "## ELAF scheduled review\n\n**Status:** " + value + "\n\nNo customer information was exported or sent.\n") : Promise.resolve();
};

async function main() {
  const directEncrypted = (process.env.ELAF_ENGAZ_STATE || "").trim();
  const directKey = process.env.ELAF_SESSION_KEY || "";
  const dbUrl = process.env.ELAF_SESSIONS_DATABASE_URL;
  const fallbackKey = process.env.ELAF_SESSION_ENCRYPTION_KEY;
  let encrypted, hexKey;
  if (directEncrypted && /^[0-9a-f]{64}$/i.test(directKey)) {
    encrypted = directEncrypted;
    hexKey = directKey;
  } else if (dbUrl && /^[0-9a-f]{64}$/i.test(fallbackKey || "")) {
    hexKey = fallbackKey;
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: true }, max: 1 });
    try {
      const r = await pool.query(
        "SELECT encrypted_state FROM engaz_browser_sessions WHERE id = $1 LIMIT 1",
        ["primary"]
      );
      encrypted = r.rows[0]?.encrypted_state;
    } finally {
      await pool.end();
    }
  } else {
    await status("NEEDS_SETUP — no cloud login session has been transferred to Actions");
    return;
  }
  if (!encrypted) {
    await status("LOGIN_REQUIRED — no saved Engaz session; no automation executed");
    return;
  }

  const blob = Buffer.from(encrypted, "base64");
  if (blob.length < 29) throw new Error("Invalid encrypted session");
  const decrypt = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(hexKey, "hex"),
    blob.subarray(0, 12)
  );
  decrypt.setAuthTag(blob.subarray(12, 28));
  const storageState = JSON.parse(Buffer.concat([
    decrypt.update(blob.subarray(28)),
    decrypt.final()
  ]).toString("utf8"));

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      storageState,
      timezoneId: "Africa/Cairo",
      locale: "en-US"
    });
    const page = await context.newPage();
    await page.goto("https://elaf.engazcrm.net/login", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });
    await page.waitForTimeout(3500);
    const url = new URL(page.url());
    const loginForm = await page.locator('input[type="password"]').count();
    const loginPath = /\/(?:login|signin|auth|forgot|reset)(?:\/|$)/i.test(url.pathname);
    if (url.origin === "https://elaf.engazcrm.net" && !loginPath && loginForm === 0) {
      await status("SESSION_CANDIDATE — dashboard appeared; requires authorized review before reading clients");
    } else {
      await status("LOGIN_REQUIRED — session expired or site requested new authentication");
    }
    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch(async (e) => {
  console.error("Scheduled review error type:", e.name);
  await status("ERROR — the read-only verification could not complete");
  process.exitCode = 1;
});
