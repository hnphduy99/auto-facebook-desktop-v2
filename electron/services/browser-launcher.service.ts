import * as chromeLauncher from "chrome-launcher";
import { getEdgePath } from "edge-paths";
import fs from "fs";
import { Browser, LaunchOptions, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { accountService } from "./account.service";
import { store } from "./store";
import { getRandomUserAgent, sendLog } from "./utils";

puppeteer.use(StealthPlugin());

export const BROWSER_ARGS = [
  "--window-size=500,700",
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-blink-features=AutomationControlled",
  "--disable-web-security",
  "--disable-features=IsolateOrigins,site-per-process",
  "--disable-dev-shm-usage",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-sync",
  "--disable-translate",
  "--disable-notifications",
  "--mute-audio"
];

export class BrowserLauncherService {
  checkChromiumAvailable(): string | null {
    try {
      const chromeInstallations = chromeLauncher.Launcher.getInstallations();
      if (chromeInstallations.length > 0) {
        return chromeInstallations[0];
      }
    } catch {}

    try {
      const edgePath = getEdgePath();
      if (edgePath && fs.existsSync(edgePath)) {
        return edgePath;
      }
    } catch {}

    return null;
  }

  getBrowserPath(): { path: string; isExternal: boolean } {
    const chromePath = this.checkChromiumAvailable();
    if (chromePath) {
      return { path: chromePath, isExternal: true };
    }
    return { path: puppeteer.executablePath(), isExternal: false };
  }

  async launchBrowser(
    accountId: string,
    windowIndex: number = 0,
    useProfile: boolean = false,
    argsSub?: string[]
  ): Promise<{ browser: Browser; page: Page }> {
    const account = accountService.getById(accountId);
    if (!account) throw new Error("Account not found");

    const userAgent = getRandomUserAgent();

    const winWidth = 500;
    const posX = (windowIndex % 4) * winWidth;
    const posY = 0;

    const args = [...BROWSER_ARGS, ...(argsSub || []), `--window-position=${posX},${posY}`];

    const launchConfig: LaunchOptions = {
      headless: false,
      args
    };

    const browserPathInfo = this.getBrowserPath();
    launchConfig.executablePath = browserPathInfo.path;

    if (useProfile) {
      launchConfig.userDataDir = store.getProfilePath(account.email);
    }

    const browser = await puppeteer.launch(launchConfig);

    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());
    await page.setUserAgent(userAgent);

    // Load cookies if available
    const cookiesPath = store.getCookiesPath(account.email);
    if (fs.existsSync(cookiesPath)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf-8"));
        if (Array.isArray(cookies) && cookies.length > 0) {
          await page.setCookie(...cookies);
          sendLog(`Đã load cookies cho ${account.email}`, "info");
        }
      } catch {
        sendLog(`Không thể đọc cookies cho ${account.email}`, "warning");
      }
    }

    return { browser, page };
  }
}

export const browserLauncher = new BrowserLauncherService();
