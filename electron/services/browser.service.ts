import * as chromeLauncher from "chrome-launcher";
import { getEdgePath } from "edge-paths";
import fs from "fs";
import { Browser, ElementHandle, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import { accountService } from "./account.service";
import { store } from "./store";
import { getRandomUserAgent, randomDelay, sendLog } from "./utils";

puppeteer.use(StealthPlugin());

const DELAYS = {
  MIN_ACTION: 1500,
  MAX_ACTION: 2000,
  AFTER_POST: 3000
};

const BROWSER_ARGS = [
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

// Track running browsers for cleanup
const runningBrowsers = new Map<string, Browser[]>();

export class BrowserService {
  /**
   * Find local Chrome or Edge installation path
   */
  findLocalChromium(): string {
    // 1. Dùng chrome-launcher để tìm Chrome
    try {
      const chromeInstallations = chromeLauncher.Launcher.getInstallations();
      if (chromeInstallations.length > 0) {
        return chromeInstallations[0];
      }
    } catch {
      // ignore lỗi
    }

    // 2. Dùng edge-paths để tìm MS Edge (fallback phổ biến trên Windows 11)
    try {
      const edgePath = getEdgePath();
      if (edgePath && fs.existsSync(edgePath)) {
        return edgePath;
      }
    } catch {
      // ignore lỗi
    }

    // 3. Mảng đường dẫn viết tay cứng dự phòng (Hardcoded paths)
    const paths: string[] = [];
    if (process.platform === "win32") {
      paths.push(
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
      );
    } else if (process.platform === "darwin") {
      paths.push(
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
      );
    } else if (process.platform === "linux") {
      paths.push("/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge");
    }

    for (const p of paths) {
      if (p && fs.existsSync(p)) {
        return p;
      }
    }

    try {
      return puppeteer.executablePath();
    } catch {
      return "";
    }
  }

  /**
   * Launch a browser instance with optional cookies
   */
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

    const launchConfig: any = {
      headless: false,
      args,
      userAgent
    };

    const localBrowser = this.findLocalChromium();
    if (localBrowser) {
      launchConfig.executablePath = localBrowser;
    }

    if (useProfile) {
      launchConfig.userDataDir = store.getProfilePath(account.email);
    }

    const browser = (await puppeteer.launch(launchConfig)) as unknown as Browser;

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

  /**
   * Check if a page is logged into Facebook
   */
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

  /**
   * Login to Facebook with email/password
   */
  async loginToFacebook(accountId: string, campaignId?: string): Promise<{ browser: Browser; page: Page }> {
    const account = accountService.getById(accountId);
    if (!account) throw new Error("Account not found");

    sendLog(`Đang đăng nhập tài khoản: ${account.email}...`, "info", campaignId);

    const { browser, page } = await this.launchBrowser(accountId, 0, false);

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
    await this.simulatePaste(page, emailSelector, account.email);
    await randomDelay(DELAYS.MIN_ACTION, DELAYS.MAX_ACTION);

    const passwordSelector = 'input[name="pass"]';
    await page.waitForSelector(passwordSelector, { timeout: 10000 });
    await this.simulatePaste(page, passwordSelector, account.password);
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

  /**
   * Post to a Facebook group
   */
  async postToGroup(
    page: Page,
    groupUrl: string,
    content: string,
    imagePaths: string[] = [],
    workerLabel: string = "",
    campaignId?: string
  ): Promise<string | null> {
    const prefix = workerLabel ? `${workerLabel} ` : "";

    // Navigate to group
    if (!page.url().includes(groupUrl)) {
      sendLog(`${prefix}Đang truy cập group: ${groupUrl}`, "info", campaignId);
      await page.goto(groupUrl, { waitUntil: "networkidle2" });
    }

    // Find post button
    sendLog(`${prefix}Đang tìm ô đăng bài...`, "info", campaignId);

    const postBtnHandle = (await page.evaluateHandle(() => {
      const keywords = ["Bạn viết gì đi", "What's on your mind", "Viết gì đó", "Create a public post"];
      const allSpans = Array.from(document.querySelectorAll("span"));
      for (const span of allSpans) {
        const text = span.textContent || "";
        if (keywords.some((kw) => text.includes(kw))) {
          const parentButton = span.closest('div[role="button"]');
          if (parentButton) return parentButton;
        }
      }
      return null;
    })) as any;

    if (postBtnHandle && postBtnHandle.asElement()) {
      sendLog(`${prefix}Đã tìm thấy ô đăng bài!`, "success", campaignId);
      const element = postBtnHandle.asElement();
      await randomDelay(100, 300);
      if (element) {
        await page.evaluate((el) => (el as HTMLElement).click(), element);
      }
    }
    await randomDelay(DELAYS.MIN_ACTION, DELAYS.MAX_ACTION);

    const contentBoxSelectors = [
      'textarea[aria-label*="Tạo bài viết công khai"], textarea[aria-label*="Create a public post"], textarea[placeholder*="Tạo bài viết"], textarea[placeholder*="Create a public"]',
      'div[data-lexical-editor="true"][contenteditable="true"]',
      'div[role="textbox"][aria-placeholder*="Bạn viết gì đi"]',
      'div[role="textbox"][aria-placeholder*="Tạo bài viết công khai"]',
      'div[role="textbox"][aria-placeholder*="What\'s on your mind"]',
      'div[data-lexical-editor="true"][aria-placeholder*="Bạn viết gì đi"]',
      'div[data-lexical-editor="true"][aria-placeholder*="What\'s on your mind"]',
      'div[role="textbox"][aria-label*="Bạn viết gì đi"]'
    ];

    sendLog(`${prefix}Đang chờ modal đăng bài...`, "info", campaignId);

    try {
      await page.waitForSelector(contentBoxSelectors.join(","), {
        timeout: 10000
      });
    } catch {
      sendLog(`${prefix}Chưa thấy modal, tiếp tục thử...`, "warning", campaignId);
    }

    let contentBox: string | null = null;
    let contentBoxElement: ElementHandle<Element> | null = null;

    for (const selector of contentBoxSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 1000 });
        contentBoxElement = await page.$(selector);
        if (contentBoxElement) {
          contentBox = selector;
          sendLog(`${prefix}Tìm thấy ô nhập nội dung!`, "success", campaignId);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!contentBox || !contentBoxElement) {
      throw new Error("Không tìm thấy ô nhập nội dung");
    }

    // Paste content
    sendLog(`${prefix}Đang dán nội dung...`, "info", campaignId);
    await this.simulatePaste(page, contentBox, content);
    await randomDelay(DELAYS.MIN_ACTION, DELAYS.MAX_ACTION);

    // Upload images if any
    if (imagePaths && imagePaths.length > 0) {
      sendLog(`${prefix}Đang upload ${imagePaths.length} ảnh...`, "info", campaignId);
      try {
        const fileChooserPromise = page.waitForFileChooser({ timeout: 10000 });

        const photoButtonSelectors = [
          'div[aria-label="Ảnh/video"][role="button"]',
          'div[aria-label="Photo/video"][role="button"]',
          'div[aria-label="Thêm ảnh"]',
          'div[aria-label="Add Photo"]'
        ];

        let clicked = false;
        for (const sel of photoButtonSelectors) {
          const el = await page.$(sel);
          if (el) {
            await el.click();
            clicked = true;
            break;
          }
        }

        if (clicked) {
          const fileChooser = await fileChooserPromise;
          await fileChooser.accept(imagePaths);
          sendLog(`${prefix}Đã upload ảnh thành công!`, "success", campaignId);
          await randomDelay(DELAYS.MIN_ACTION + 500, DELAYS.MAX_ACTION + 500);
        }
      } catch (error: any) {
        sendLog(`${prefix}Lỗi upload ảnh: ${error.message}`, "warning", campaignId);
      }
    }

    // === INTERCEPTOR: Bắt link bài đăng từ GraphQL response ===
    let interceptedPostUrl: string | null = null;

    const responseHandler = async (response: any) => {
      try {
        if (interceptedPostUrl) return;
        if (!response.url().includes("/api/graphql")) return;
        const buffer = await response.buffer();
        const text = buffer.toString("utf-8");
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const json = JSON.parse(trimmed);
            const postUrl = json?.data?.story_create?.story?.url;
            if (postUrl && typeof postUrl === "string") {
              interceptedPostUrl = postUrl;
              sendLog(`${prefix}[Interceptor] Bắt được link bài đăng: ${interceptedPostUrl}`, "info", campaignId);
              return;
            }
          } catch {
            // skip dòng không parse được
          }
        }
      } catch {
        // ignore
      }
    };

    page.on("response", responseHandler);

    // Find and click Post button
    sendLog(`${prefix}Đang tìm nút Đăng bài...`, "info", campaignId);

    const postButtonSelectors = ['div[aria-label="Đăng"][role="button"]', 'div[aria-label="Post"][role="button"]'];

    let postButtonFound = false;
    for (const selector of postButtonSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const text = await page.evaluate((el) => el.textContent, element);
          if (text && (text.includes("Đăng") || text.includes("Post"))) {
            const isDisabled = await page.evaluate((el) => {
              return el.getAttribute("aria-disabled") === "true" || el.hasAttribute("disabled");
            }, element);

            if (!isDisabled) {
              await randomDelay(DELAYS.MIN_ACTION, DELAYS.MAX_ACTION);
              await element.click();
              postButtonFound = true;
              break;
            }
          }
        }
        if (postButtonFound) break;
      } catch {
        continue;
      }
    }

    if (!postButtonFound) {
      page.off("response", responseHandler);
      throw new Error("Không tìm thấy nút Đăng bài");
    }

    // Wait for post to complete
    sendLog(`${prefix}Đang gửi bài viết...`, "info", campaignId);
    let postSuccess = false;
    try {
      if (contentBox) {
        await page.waitForSelector(contentBox, {
          hidden: true,
          timeout: 60000
        });
        postSuccess = true;
        sendLog(`${prefix}Bài viết đã được gửi thành công!`, "success", campaignId);
      }
    } catch {
      sendLog(`${prefix}Modal không đóng sau 60s`, "warning", campaignId);
    }

    // Chờ thêm 5 giây để interceptor có thời gian bắt API response từ Facebook
    if (postSuccess) {
      sendLog(`${prefix}Đang chờ lấy link bài đăng...`, "info", campaignId);
      await randomDelay(5000, 7000);
    }

    // Gỡ bắt listener
    page.off("response", responseHandler);

    // Lấy URL bài đăng
    const postUrl: string | null = interceptedPostUrl;

    if (postUrl) {
      sendLog(`${prefix}🔗 Link bài đăng: ${postUrl}`, "success", campaignId);
    } else if (postSuccess) {
      sendLog(`${prefix}Không bắt được link bài đăng. Bài có thể đang chờ duyệt.`, "info", campaignId);
    }

    await randomDelay(DELAYS.MIN_ACTION, DELAYS.MAX_ACTION);
    return postUrl;
  }

  /**
   * Run a full campaign
   */
  async runCampaign(
    accountId: string,
    content: string,
    images: string[],
    groups: string[],
    maxConcurrent: number,
    campaignId: string
  ): Promise<{ groupUrl: string; success: boolean; error?: string; postUrl?: string }[]> {
    const results: { groupUrl: string; success: boolean; error?: string; postUrl?: string }[] = [];

    // Phase 1: Login check
    sendLog("PHA 1: Kiểm tra đăng nhập...", "info", campaignId);

    const account = accountService.getById(accountId);
    if (!account) throw new Error("Account not found");

    const cookiesPath = store.getCookiesPath(account.email);
    let shouldLogin = true;

    if (fs.existsSync(cookiesPath)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf-8"));
        if (Array.isArray(cookies) && cookies.length > 0) {
          sendLog("Tìm thấy cookies hợp lệ, bỏ qua đăng nhập.", "success", campaignId);
          shouldLogin = false;
        }
      } catch {
        // Will login
      }
    }

    if (shouldLogin) {
      const session = await this.loginToFacebook(accountId, campaignId);
      await session.browser.close();
      await randomDelay(1000, 1500);
    }

    // Phase 2: Run workers
    sendLog(`PHA 2: Bắt đầu đăng bài lên ${groups.length} groups...`, "info", campaignId);

    const browsers: Browser[] = [];
    runningBrowsers.set(campaignId, browsers);

    try {
      for (let i = 0; i < groups.length; i += maxConcurrent) {
        // Check if campaign was stopped
        if (!runningBrowsers.has(campaignId)) {
          sendLog("Chiến dịch đã bị dừng!", "warning", campaignId);
          break;
        }

        const batchGroups = groups.slice(i, i + maxConcurrent);
        const batchIndex = Math.floor(i / maxConcurrent) + 1;
        const totalBatches = Math.ceil(groups.length / maxConcurrent);

        sendLog(`Đợt ${batchIndex}/${totalBatches} (${batchGroups.length} trình duyệt)...`, "info", campaignId);

        const promises = batchGroups.map(async (groupUrl, index) => {
          let browser: Browser | null = null;
          try {
            const session = await this.launchBrowser(accountId, index, false, ["--headless=true"]);
            browser = session.browser;
            browsers.push(browser);
            const page = session.page;

            // Navigate to group
            await page.goto(groupUrl, {
              waitUntil: "networkidle2",
              timeout: 60000
            });

            // Check login
            const isLoggedIn = await this.checkLoginStatus(page);
            let postUrl: string | null = null;
            if (!isLoggedIn) {
              sendLog(`[Worker ${index + 1}] Session hết hạn, đang đăng nhập lại...`, "warning", campaignId);
              await page.close();
              const recovery = await this.loginToFacebook(accountId, campaignId);
              const newPage = recovery.page;
              await newPage.goto(groupUrl, {
                waitUntil: "networkidle2",
                timeout: 60000
              });
              postUrl = await this.postToGroup(newPage, groupUrl, content, images, `[Worker ${index + 1}]`, campaignId);
              await recovery.browser.close();
            } else {
              postUrl = await this.postToGroup(page, groupUrl, content, images, `[Worker ${index + 1}]`, campaignId);
            }

            results.push({ groupUrl, success: true, postUrl: postUrl || undefined });
          } catch (err: any) {
            sendLog(`[Worker ${index + 1}] Lỗi: ${err.message}`, "error", campaignId);
            results.push({ groupUrl, success: false, error: err.message });
          } finally {
            if (browser) {
              try {
                await browser.close();
              } catch {
                // ignore
              }
            }
          }
        });

        await Promise.all(promises);

        if (i + maxConcurrent < groups.length) {
          sendLog(`Nghỉ ${DELAYS.AFTER_POST / 1000}s giữa các đợt...`, "info", campaignId);
          await randomDelay(DELAYS.AFTER_POST, DELAYS.AFTER_POST);
        }
      }
    } finally {
      runningBrowsers.delete(campaignId);
    }

    return results;
  }

  /**
   * Stop a running campaign
   */
  async stopCampaign(campaignId: string): Promise<void> {
    const browsers = runningBrowsers.get(campaignId);
    if (browsers) {
      for (const browser of browsers) {
        try {
          await browser.close();
        } catch {
          // ignore
        }
      }
      runningBrowsers.delete(campaignId);
      sendLog("Đã dừng chiến dịch", "warning", campaignId);
    }
  }

  /**
   * Save page cookies to file
   */
  private async saveCookies(page: Page, email: string): Promise<void> {
    const cookies = await page.cookies();
    const cookiesPath = store.getCookiesPath(email);
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
  }

  /**
   * Simulate paste into an input
   */
  private async simulatePaste(page: Page, selector: string, text: string): Promise<void> {
    try {
      await page.focus(selector);
      await page.click(selector);

      const isMac = process.platform === "darwin";
      const modifier = isMac ? "Meta" : "Control";

      await page.keyboard.down(modifier);
      await page.keyboard.press("A");
      await page.keyboard.up(modifier);
      await page.keyboard.press("Backspace");

      await randomDelay(100, 300);

      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line) {
          if (line.endsWith(".")) {
            const content = line.slice(0, -1);
            if (content) {
              await page.evaluate((txt) => {
                (document as any).execCommand("insertText", false, txt);
              }, content);
            }
            await page.keyboard.type(".");
            await randomDelay(50, 100);
          } else {
            await page.evaluate((txt) => {
              (document as any).execCommand("insertText", false, txt);
            }, line);
          }
        }
        if (i < lines.length - 1) {
          await page.keyboard.down("Shift");
          await page.keyboard.press("Enter");
          await page.keyboard.up("Shift");
          await randomDelay(50, 150);
        }
      }
    } catch {
      // Fallback: type each character
      try {
        await page.click(selector);
        for (const char of text) {
          if (char === "\n") {
            await page.keyboard.down("Shift");
            await page.keyboard.press("Enter");
            await page.keyboard.up("Shift");
          } else {
            await page.keyboard.type(char);
          }
        }
      } catch {
        // ignore
      }
    }
  }

  /**
   * Comment vào một bài đăng cụ thể (text + ảnh)
   */
  async commentOnPost(
    page: Page,
    postUrl: string,
    comment: { text: string; images: string[] },
    prefix: string,
    campaignId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      sendLog(`${prefix}Đang điều hướng tới bài viết...`, "info", campaignId);
      await page.goto(postUrl, { waitUntil: "networkidle2", timeout: 30000 });
      await randomDelay(2000, 3000);

      // --- Tìm ô comment ---
      const commentBoxSelectors = [
        'div[role="textbox"][aria-placeholder*="Viết bình luận công khai…"]',
        'div[role="textbox"][aria-placeholder*="Write a comment"]',
        'div[role="textbox"][aria-placeholder*="comment"]',
        'div[role="textbox"][contenteditable="true"]'
      ];

      let commentBox: ElementHandle | null = null;
      for (const sel of commentBoxSelectors) {
        try {
          await page.waitForSelector(sel, { timeout: 5000 });
          const boxes = await page.$$(sel);
          if (boxes.length > 0) {
            commentBox = boxes[boxes.length - 1];
            break;
          }
        } catch {
          continue;
        }
      }

      if (!commentBox) {
        // Scroll xuống để load comment box
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
        await randomDelay(1000, 1500);
        for (const sel of commentBoxSelectors) {
          try {
            const boxes = await page.$$(sel);
            if (boxes.length > 0) {
              commentBox = boxes[boxes.length - 1];
              break;
            }
          } catch {
            continue;
          }
        }
      }

      if (!commentBox) {
        return { success: false, error: "Không tìm thấy ô comment" };
      }

      sendLog(`${prefix}Đã tìm thấy ô comment, nhập nội dung...`, "info", campaignId);
      await commentBox.click();
      await randomDelay(800, 1200);

      // Nhập text
      if (comment.text && comment.text.trim()) {
        await this.simulatePaste(page, 'div[role="textbox"][contenteditable="true"]', comment.text);
        await randomDelay(500, 800);
      }

      // Upload ảnh nếu có
      if (comment.images && comment.images.length > 0) {
        sendLog(`${prefix}Đang thêm ảnh vào comment...`, "info", campaignId);
        const photoSelectors = [
          'div[aria-label="Đính kèm một ảnh hoặc video"][role="button"]',
          'div[aria-label="Attach an image or video"][role="button"]'
        ];

        let photoBtn: ElementHandle | null = null;
        for (const sel of photoSelectors) {
          try {
            const btns = await page.$$(sel);
            if (btns.length > 0) {
              photoBtn = btns[0];
              break;
            }
          } catch {
            continue;
          }
        }

        if (photoBtn) {
          try {
            const [fileChooser] = await Promise.all([page.waitForFileChooser({ timeout: 5000 }), photoBtn.click()]);
            await fileChooser.accept(comment.images);
            await randomDelay(2000, 3000);
            sendLog(`${prefix}Đã tải ảnh lên`, "info", campaignId);
          } catch {
            sendLog(`${prefix}Không thể tải ảnh, tiếp tục không có ảnh`, "warning", campaignId);
          }
        } else {
          sendLog(`${prefix}Không tìm thấy nút thêm ảnh`, "warning", campaignId);
        }
      }

      // Gửi comment bằng cách click nút "Bình luận"
      sendLog(`${prefix}Đang gửi comment...`, "info", campaignId);
      const submitSelectors = [
        'div[aria-label="Bình luận"][role="button"]',
        'div[aria-label="Comment"][role="button"]'
      ];
      let submitted = false;
      for (const sel of submitSelectors) {
        try {
          const btn = await page.$(sel);
          if (btn) {
            await btn.click();
            submitted = true;
            break;
          }
        } catch {
          continue;
        }
      }
      if (!submitted) {
        // Fallback: nhấn Enter nếu không tìm thấy nút
        sendLog(`${prefix}Không tìm thấy nút Bình luận, dùng Enter...`, "warning", campaignId);
        await page.keyboard.press("Enter");
      }
      await randomDelay(2000, 3000);
      sendLog(`${prefix}✅ Comment đã được gửi!`, "success", campaignId);

      await randomDelay(2000, 3000);
      return { success: true };
    } catch (error: any) {
      sendLog(`${prefix}❌ Lỗi comment: ${error.message}`, "error", campaignId);
      return { success: false, error: error.message };
    }
  }

  /**
   * Chạy chiến dịch comment hàng loạt
   */
  async runCommentCampaign(
    accountId: string,
    posts: { id: string; postUrl: string }[],
    comments: { text: string; images: string[] }[],
    delayBetweenComments: number,
    delayBetweenPosts: number,
    campaignId: string
  ): Promise<{ postId: string; postUrl: string; comments: { index: number; success: boolean; error?: string }[] }[]> {
    sendLog(`[Comment Campaign] Bắt đầu: ${posts.length} bài × ${comments.length} comment`, "info", campaignId);

    let browser: Browser | null = null;
    let page: Page | null = null;
    const results: {
      postId: string;
      postUrl: string;
      comments: { index: number; success: boolean; error?: string }[];
    }[] = [];

    try {
      const { browser: b, page: p } = await this.loginToFacebook(accountId, campaignId);
      browser = b;
      page = p;

      for (let pi = 0; pi < posts.length; pi++) {
        const post = posts[pi];
        const prefix = `[Bài ${pi + 1}/${posts.length}] `;
        sendLog(`${prefix}Xử lý: ${post.postUrl}`, "info", campaignId);

        const commentResults: { index: number; success: boolean; error?: string }[] = [];

        for (let ci = 0; ci < comments.length; ci++) {
          const cmt = comments[ci];
          const cPrefix = `${prefix}[Comment ${ci + 1}/${comments.length}] `;
          const result = await this.commentOnPost(page, post.postUrl, cmt, cPrefix, campaignId);
          commentResults.push({ index: ci, ...result });

          if (ci < comments.length - 1) {
            await randomDelay(delayBetweenComments, delayBetweenComments + 1000);
          }
        }

        results.push({ postId: post.id, postUrl: post.postUrl, comments: commentResults });

        if (pi < posts.length - 1) {
          sendLog(`${prefix}Chờ ${delayBetweenPosts / 1000}s...`, "info", campaignId);
          await randomDelay(delayBetweenPosts, delayBetweenPosts + 2000);
        }
      }

      sendLog(`[Comment Campaign] Hoàn tất! ${posts.length} bài đã xử lý.`, "success", campaignId);
    } catch (error: any) {
      sendLog(`[Comment Campaign] Lỗi: ${error.message}`, "error", campaignId);
      throw error;
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          /* ignore */
        }
      }
    }

    return results;
  }
}

export const browserService = new BrowserService();
