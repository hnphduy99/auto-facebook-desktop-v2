import crypto from "crypto";
import { getMachineId } from "./encryption.service.js";
import { store } from "./store.js";

// ─── Constants ──────────────────────────────────────────────────────────────
// IMPORTANT: Thay đổi giá trị này thành một chuỗi bí mật của bạn trước khi phát hành!
// Giá trị này dùng để ký license keys – giữ bí mật tuyệt đối.
const LICENSE_SECRET = "af-license-secret-DO-CHANGE-THIS";

export type LicenseTier = "trial" | "basic" | "pro";

export interface LicenseInfo {
  key: string;
  tier: LicenseTier;
  expiresAt: string | null; // ISO string or null (lifetime)
  activatedAt: string;
  machineId: string;
  isValid: boolean;
  daysLeft: number | null; // null = lifetime
}

export interface LicenseLimits {
  maxAccounts: number;
  maxGroups: number; // per campaign
  maxConcurrent: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function signPayload(encoded: string): string {
  return crypto.createHmac("sha256", LICENSE_SECRET).update(encoded).digest("hex").slice(0, 12);
}

function encodePayload(data: object): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

function decodePayload<T>(encoded: string): T {
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class LicenseService {
  /**
   * [ADMIN TOOL] Generates a new license key to sell.
   * tier: "trial" | "basic" | "pro"
   * expiryDays: null = lifetime, number = days until expiry
   *
   * Usage (in Node REPL or admin script):
   *   const { licenseService } = require('./dist/services/license.service.js');
   *   console.log(licenseService.generateKey('basic', 30));
   */
  generateKey(tier: LicenseTier, expiryDays: number | null = 30): string {
    const payload = {
      tier,
      exp: expiryDays ? Date.now() + expiryDays * 86_400_000 : null,
      nonce: crypto.randomBytes(6).toString("hex")
    };

    const encoded = encodePayload(payload);
    const sig = signPayload(encoded);
    return `${encoded}.${sig}`;
  }

  /**
   * Activates a license key on this machine.
   * Throws an error with a user-friendly message if invalid.
   */
  activate(rawKey: string): LicenseInfo {
    const key = rawKey.trim();
    const parts = key.split(".");

    if (parts.length < 2) {
      throw new Error("License key không đúng định dạng.");
    }

    const sig = parts.pop()!;
    const encoded = parts.join(".");

    // Verify signature
    const expectedSig = signPayload(encoded);
    if (sig !== expectedSig) {
      throw new Error("License key không hợp lệ hoặc đã bị chỉnh sửa.");
    }

    // Decode payload
    let payload: { tier: LicenseTier; exp: number | null; nonce: string };
    try {
      payload = decodePayload(encoded);
    } catch {
      throw new Error("License key không đọc được.");
    }

    // Check expiry
    if (payload.exp !== null && payload.exp < Date.now()) {
      throw new Error("License key này đã hết hạn sử dụng.");
    }

    const machineId = getMachineId();
    const licenseData = {
      key,
      tier: payload.tier,
      expiresAt: payload.exp ? new Date(payload.exp).toISOString() : null,
      activatedAt: new Date().toISOString(),
      machineId
    };

    store.set("license", licenseData as any);
    return this.getLicenseInfo()!;
  }

  /**
   * Returns current license info, or null if not activated.
   */
  getLicenseInfo(): LicenseInfo | null {
    const data = store.get("license") as any;
    if (!data || !data.key) return null;

    const machineId = getMachineId();
    const now = Date.now();

    // Machine binding check
    if (data.machineId !== machineId) {
      return {
        ...data,
        isValid: false,
        daysLeft: null
      };
    }

    // Expiry check
    let isValid = true;
    let daysLeft: number | null = null;

    if (data.expiresAt) {
      const expiry = new Date(data.expiresAt).getTime();
      if (expiry < now) {
        isValid = false;
      } else {
        daysLeft = Math.ceil((expiry - now) / 86_400_000);
      }
    }

    return { ...data, isValid, daysLeft };
  }

  /**
   * Whether a valid license is currently active.
   */
  isActivated(): boolean {
    const info = this.getLicenseInfo();
    return info !== null && info.isValid;
  }

  /**
   * Returns the current license tier, or null if not activated.
   */
  getTier(): LicenseTier | null {
    const info = this.getLicenseInfo();
    return info?.isValid ? info.tier : null;
  }

  /**
   * Returns the limits for the current license tier.
   */
  getLimits(): LicenseLimits {
    const tier = this.getTier();
    switch (tier) {
      case "trial":
        return { maxAccounts: 1, maxGroups: 5, maxConcurrent: 1 };
      case "basic":
        return { maxAccounts: 3, maxGroups: 50, maxConcurrent: 2 };
      case "pro":
        return { maxAccounts: 10, maxGroups: 999, maxConcurrent: 5 };
      default:
        return { maxAccounts: 0, maxGroups: 0, maxConcurrent: 0 };
    }
  }

  /**
   * Deactivates the current license (removes from store).
   */
  deactivate(): void {
    store.set("license", null as any);
  }
}

export const licenseService = new LicenseService();
