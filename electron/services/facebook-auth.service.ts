import fs from "fs";
import { Browser, Page } from "puppeteer";
import { accountService } from "./account.service";
import { browserLauncher } from "./browser-launcher.service";
import { DELAYS, simulatePaste } from "./page-interaction.utils";
import { store } from "./store";
import { randomDelay, sendLog } from "./utils";

export class FacebookAuthService {
  async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      const combinedSelector = [
        'div[aria-label="Tài khoản"]',
        'div[aria-label="Account"]',
        'a[aria-label="Trang chủ"]',
        'a[aria-label="Home"]',
        'div[aria-label="Thông báo"]',
        'div[aria-label="Messenger"]'
      ].join(",");

      await page.waitForSelector(combinedSelector, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async loginToFacebook(accountId: string, campaignId?: string): Promise<{ browser: Browser; page: Page }> {
    const account = accountService.getById(accountId);
    if (!account) throw new Error("Account not found");

    sendLog(`Đang đăng nhập tài khoản: ${account.email}...`, "info", campaignId);

    const { browser, page } = await browserLauncher.launchBrowser(accountId, 0, false);

    try {
      await page.goto("https://www.facebook.com/", {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });
    } catch (e: any) {
      sendLog("Load trang hơi lâu, tiếp tục kiểm tra..." + e.message, "warning", campaignId);
    }

    const isAlreadyLoggedIn = await this.checkLoginStatus(page);
    if (isAlreadyLoggedIn) {
      sendLog(`Tài khoản ${account.email} đã đăng nhập sẵn!`, "success", campaignId);
      await this.saveCookies(page, account.email);
      accountService.update(accountId, {
        status: "active",
        lastLogin: new Date().toISOString()
      });
      return { browser, page };
    }

    // Try login with credentials
    sendLog("Đang đăng nhập bằng email/mật khẩu...", "info", campaignId);
    await page.goto("https://www.facebook.com/", {
      waitUntil: "domcontentloaded"
    });

    const emailSelector = 'input[name="email"]';
    await page.waitForSelector(emailSelector, { timeout: 10000 });
    await simulatePaste(page, emailSelector, account.email);
    await randomDelay(DELAYS.MIN_ACTION, DELAYS.MAX_ACTION);

    const passwordSelector = 'input[name="pass"]';
    await page.waitForSelector(passwordSelector, { timeout: 10000 });
    await simulatePaste(page, passwordSelector, account.password);
    await randomDelay(DELAYS.MIN_ACTION, DELAYS.MAX_ACTION);

    const loginButtonSelector = 'div[role="button"][aria-label="Đăng nhập"], div[role="button"][aria-label="Log in"]';
    await page.waitForSelector(loginButtonSelector, { timeout: 10000 });

    sendLog("Đang click nút đăng nhập...", "info", campaignId);
    await page.click(loginButtonSelector);

    sendLog("Đang đợi đăng nhập (Nếu Facebook yêu cầu 2FA, hãy thao tác trên trình duyệt)...", "warning", campaignId);

    // Wait for login with timeout
    let isLoggedIn = false;
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        isLoggedIn = await this.checkLoginStatus(page);
        if (isLoggedIn) break;
      } catch (error: any) {
        if (error.message.includes("Execution context was destroyed") || error.message.includes("Navigation")) {
          await randomDelay(2000, 3000);
          continue;
        }
        throw error;
      }
      await randomDelay(DELAYS.MIN_ACTION, DELAYS.MAX_ACTION);
    }

    if (isLoggedIn) {
      sendLog(`Đăng nhập thành công: ${account.email}`, "success", campaignId);
      await this.saveCookies(page, account.email);
      accountService.update(accountId, {
        status: "active",
        lastLogin: new Date().toISOString()
      });
      return { browser, page };
    } else {
      accountService.update(accountId, { status: "error" });
      await browser.close();
      throw new Error("Đăng nhập thất bại hoặc hết hạn chờ xác minh");
    }
  }

  async saveCookies(page: Page, email: string): Promise<void> {
    const cookies = await page.cookies();
    const cookiesPath = store.getCookiesPath(email);
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
  }
}

export const facebookAuth = new FacebookAuthService();
