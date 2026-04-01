#!/usr/bin/env node
/**
 * ADMIN TOOL — Generate License Keys
 *
 * Dùng để tạo license key để bán cho khách hàng.
 *
 * Usage:
 *   node generate-license.mjs [tier] [days]
 *   node generate-license.mjs trial 7
 *   node generate-license.mjs basic 30
 *   node generate-license.mjs pro 90
 *   node generate-license.mjs pro null   (lifetime)
 *
 * IMPORTANT: Đổi LICENSE_SECRET trong license.service.ts và file này
 *            thành cùng một giá trị bí mật trước khi phát hành!
 */

import crypto from "crypto";

// ⚠️ PHẢI GIỐNG với giá trị trong electron/services/license.service.ts
const LICENSE_SECRET = "af-license-secret-DO-CHANGE-THIS";

const VALID_TIERS = ["trial", "basic", "pro"];
const DEFAULT_EXPIRY = { trial: 7, basic: 30, pro: 90 };

function signPayload(encoded) {
  return crypto.createHmac("sha256", LICENSE_SECRET).update(encoded).digest("hex").slice(0, 12);
}

function generateKey(tier, expiryDays) {
  const payload = {
    tier,
    exp: expiryDays ? Date.now() + expiryDays * 86_400_000 : null,
    nonce: crypto.randomBytes(6).toString("hex")
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = signPayload(encoded);
  return `${encoded}.${sig}`;
}

// Parse arguments
const args = process.argv.slice(2);
const tier = args[0] || "trial";
const daysArg = args[1];

if (!VALID_TIERS.includes(tier)) {
  console.error(`❌ Tier không hợp lệ: "${tier}". Chọn 1 trong: ${VALID_TIERS.join(", ")}`);
  process.exit(1);
}

let expiryDays;
if (daysArg === "null" || daysArg === "lifetime") {
  expiryDays = null;
} else if (daysArg) {
  expiryDays = parseInt(daysArg, 10);
  if (isNaN(expiryDays) || expiryDays <= 0) {
    console.error(`❌ Số ngày không hợp lệ: "${daysArg}"`);
    process.exit(1);
  }
} else {
  expiryDays = DEFAULT_EXPIRY[tier];
}

const key = generateKey(tier, expiryDays);

const expiryStr = expiryDays
  ? `${expiryDays} ngày (hết hạn: ${new Date(Date.now() + expiryDays * 86_400_000).toLocaleDateString("vi-VN")})`
  : "Vĩnh viễn (lifetime)";

console.log("\n╔═══════════════════════════════════════════════════════════╗");
console.log("║              🔑 LICENSE KEY GENERATOR                     ║");
console.log("╚═══════════════════════════════════════════════════════════╝\n");
console.log(`📦 Tier     : ${tier.toUpperCase()}`);
console.log(`⏳ Hạn sử dụng: ${expiryStr}`);
console.log(`\n🗝️  License Key:\n`);
console.log(`   ${key}`);
console.log(`\n📋 Copy key ở trên và gửi cho khách hàng.\n`);
