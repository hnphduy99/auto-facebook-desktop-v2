import fs from "fs";
import { Browser, ElementHandle, Page } from "puppeteer";

import { accountService } from "./account.service";
import { browserLauncher } from "./browser-launcher.service";
import { facebookAuth } from "./facebook-auth.service";
import { DELAYS, simulatePaste } from "./page-interaction.utils";
import { store } from "./store";
import { randomDelay, sendLog } from "./utils";

// Track running browsers for cleanup
const runningBrowsers = new Map<string, Browser[]>();

export class FacebookPostService {
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
      await page.waitForSelector(contentBoxSelectors.join(","), { timeout: 10000 });
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

    sendLog(`${prefix}Đang dán nội dung...`, "info", campaignId);
    await simulatePaste(page, contentBox, content);
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

    // Interceptor: bắt link bài đăng từ GraphQL response
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
            // skip
          }
        }
      } catch {
        // ignore
      }
    };

    page.on("response", responseHandler);

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

    sendLog(`${prefix}Đang gửi bài viết...`, "info", campaignId);
    let postSuccess = false;
    try {
      if (contentBox) {
        await page.waitForSelector(contentBox, { hidden: true, timeout: 60000 });
        postSuccess = true;
        sendLog(`${prefix}Bài viết đã được gửi thành công!`, "success", campaignId);
      }
    } catch {
      sendLog(`${prefix}Modal không đóng sau 60s`, "warning", campaignId);
    }

    if (postSuccess) {
      sendLog(`${prefix}Đang chờ lấy link bài đăng...`, "info", campaignId);
      await randomDelay(5000, 7000);
    }

    page.off("response", responseHandler);

    const postUrl: string | null = interceptedPostUrl;

    if (postUrl) {
      sendLog(`${prefix}🔗 Link bài đăng: ${postUrl}`, "success", campaignId);
    } else if (postSuccess) {
      sendLog(`${prefix}Không bắt được link bài đăng. Bài có thể đang chờ duyệt.`, "info", campaignId);
    }

    await randomDelay(DELAYS.MIN_ACTION, DELAYS.MAX_ACTION);
    return postUrl;
  }

  async runCampaign(
    accountId: string,
    content: string,
    images: string[],
    groups: string[],
    maxConcurrent: number,
    campaignId: string
  ): Promise<{ groupUrl: string; success: boolean; error?: string; postUrl?: string }[]> {
    const results: { groupUrl: string; success: boolean; error?: string; postUrl?: string }[] = [];

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
      const session = await facebookAuth.loginToFacebook(accountId, campaignId);
      await session.browser.close();
      await randomDelay(1000, 1500);
    }

    sendLog(`PHA 2: Bắt đầu đăng bài lên ${groups.length} groups...`, "info", campaignId);

    const browsers: Browser[] = [];
    runningBrowsers.set(campaignId, browsers);

    try {
      for (let i = 0; i < groups.length; i += maxConcurrent) {
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
            const session = await browserLauncher.launchBrowser(accountId, index, false, ["--headless=true"]);
            browser = session.browser;
            browsers.push(browser);
            const page = session.page;

            await page.goto(groupUrl, { waitUntil: "networkidle2", timeout: 60000 });

            const isLoggedIn = await facebookAuth.checkLoginStatus(page);
            let postUrl: string | null = null;
            if (!isLoggedIn) {
              sendLog(`[Worker ${index + 1}] Session hết hạn, đang đăng nhập lại...`, "warning", campaignId);
              await page.close();
              const recovery = await facebookAuth.loginToFacebook(accountId, campaignId);
              const newPage = recovery.page;
              await newPage.goto(groupUrl, { waitUntil: "networkidle2", timeout: 60000 });
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
}

export const facebookPost = new FacebookPostService();
