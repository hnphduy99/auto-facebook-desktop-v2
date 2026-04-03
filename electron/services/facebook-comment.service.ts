import { Browser, ElementHandle, Page } from "puppeteer";
import { facebookAuth } from "./facebook-auth.service";
import { simulatePaste } from "./page-interaction.utils";
import { randomDelay, sendLog } from "./utils";

export class FacebookCommentService {
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

      if (comment.text && comment.text.trim()) {
        await simulatePaste(page, 'div[role="textbox"][contenteditable="true"]', comment.text);
        await randomDelay(500, 800);
      }

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
      const { browser: b, page: p } = await facebookAuth.loginToFacebook(accountId, campaignId);
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

export const facebookComment = new FacebookCommentService();
