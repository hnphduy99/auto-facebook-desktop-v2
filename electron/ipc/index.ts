import { app, dialog, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { runApiFacebookPosts } from "../services/api-facebook.service.js";
import { accountService } from "../services/account.service.js";
import { browserService } from "../services/browser.service.js";
import { campaignService } from "../services/campaign.service.js";
import { commentCampaignService } from "../services/comment-campaign.service.js";
import { contentService } from "../services/content.service.js";
import { licenseService } from "../services/license.service.js";
import { postService } from "../services/post.service.js";
import { SchedulerService } from "../services/scheduler.service.js";
import { store } from "../services/store.js";
import { sendCampaignUpdate, sendLog } from "../services/utils.js";

export function registerAllIPC(): void {
  // ===== ACCOUNTS =====
  ipcMain.handle("accounts:getAll", () => accountService.getAll());

  ipcMain.handle("accounts:add", (_event, data) => accountService.add(data));

  ipcMain.handle("accounts:update", (_event, id, updates) => accountService.update(id, updates));

  ipcMain.handle("accounts:delete", (_event, id) => accountService.delete(id));

  ipcMain.handle("accounts:check", async (_event, id) => {
    try {
      const { browser } = await browserService.loginToFacebook(id);
      await browser.close();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ===== CONTENTS =====
  ipcMain.handle("contents:getAll", () => contentService.getAll());

  ipcMain.handle("contents:add", (_event, data) => contentService.add(data));

  ipcMain.handle("contents:update", (_event, id, updates) => contentService.update(id, updates));

  ipcMain.handle("contents:delete", (_event, id) => contentService.delete(id));

  // ===== CAMPAIGNS =====
  ipcMain.handle("campaigns:getAll", () => campaignService.getAll());

  ipcMain.handle("campaigns:add", (_event, data) => campaignService.add(data));

  ipcMain.handle("campaigns:update", (_event, id, updates) => campaignService.update(id, updates));

  ipcMain.handle("campaigns:delete", (_event, id) => campaignService.delete(id));

  ipcMain.handle("campaigns:run", async (_event, id) => {
    const campaign = campaignService.getById(id);
    if (!campaign) throw new Error("Campaign not found");

    const content = contentService.getById(campaign.contentId);
    if (!content) throw new Error("Content not found");

    // Update status
    campaignService.update(id, { status: "running" });
    sendCampaignUpdate(campaignService.getById(id));

    try {
      const results = await browserService.runCampaign(
        campaign.accountId,
        content.body,
        content.images,
        campaign.groups,
        campaign.maxConcurrent,
        id
      );

      // --- NEW: Auto-save successful posts ---
      for (const r of results) {
        if (r.success && r.postUrl) {
          postService.add({
            postUrl: r.postUrl,
            groupUrl: r.groupUrl,
            groupName: "",
            campaignId: id,
            campaignName: campaign.name,
            accountId: campaign.accountId,
            contentSnippet: content.body ? content.body.substring(0, 50) + "..." : "No text"
          });
        }
      }

      const currentCampaign = campaignService.getById(id);
      if (currentCampaign?.status === "stopped") {
        campaignService.update(id, {
          results,
          completedAt: new Date().toISOString()
        });
        sendCampaignUpdate(campaignService.getById(id));
        return;
      }

      const hasFailures = results.some((r) => !r.success);
      campaignService.update(id, {
        status: hasFailures ? "failed" : "completed",
        results,
        completedAt: new Date().toISOString()
      });

      const successCount = results.filter((r) => r.success).length;
      sendLog(
        `Chiến dịch hoàn tất: ${successCount}/${results.length} thành công`,
        hasFailures ? "warning" : "success",
        id
      );
      sendCampaignUpdate(campaignService.getById(id));
    } catch (error: any) {
      const currentCampaign = campaignService.getById(id);
      if (currentCampaign?.status !== "stopped") {
        campaignService.update(id, {
          status: "failed",
          completedAt: new Date().toISOString()
        });
        sendCampaignUpdate(campaignService.getById(id));
        sendLog(`Lỗi chiến dịch: ${error.message}`, "error", id);
      }
    }
  });

  ipcMain.handle("campaigns:stop", async (_event, id) => {
    campaignService.update(id, { status: "stopped" });
    await browserService.stopCampaign(id);
    sendCampaignUpdate(campaignService.getById(id));
  });

  // ===== SCHEDULER =====
  ipcMain.handle("scheduler:schedule", (_event, id, datetime) => {
    SchedulerService.getInstance().schedule(id, datetime);
    sendCampaignUpdate(campaignService.getById(id));
  });

  ipcMain.handle("scheduler:cancel", (_event, id) => {
    SchedulerService.getInstance().cancelSchedule(id);
    sendCampaignUpdate(campaignService.getById(id));
  });

  ipcMain.handle("scheduler:getAll", () => campaignService.getScheduled());

  // ===== FILE DIALOG =====
  ipcMain.handle("dialog:selectImages", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Images",
          extensions: ["jpg", "jpeg", "png", "gif", "webp", "bmp"]
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) return [];

    const uploadsDir = store.getUploadsDir();
    const copiedPaths: string[] = [];

    for (const srcPath of result.filePaths) {
      // Nếu ảnh đã nằm trong thư mục uploads thì dùng luôn, không copy lại
      if (srcPath.startsWith(uploadsDir)) {
        copiedPaths.push(srcPath);
        continue;
      }

      const ext = path.extname(srcPath);
      const baseName = path.basename(srcPath, ext);
      const timestamp = Date.now();
      const destName = `${baseName}_${timestamp}${ext}`;
      const destPath = path.join(uploadsDir, destName);

      fs.copyFileSync(srcPath, destPath);
      copiedPaths.push(destPath);
    }

    return copiedPaths;
  });

  // ===== STATS =====
  ipcMain.handle("stats:get", () => {
    const accounts = accountService.getAll();
    const contents = contentService.getAll();
    const campaigns = campaignService.getAll();
    const scheduled = campaigns.filter((c) => c.status === "scheduled");
    const completed = campaigns.filter(
      (c) => c.status === "completed" || c.status === "failed" || c.status === "stopped"
    );

    let totalSuccess = 0;
    let totalResults = 0;
    for (const c of completed) {
      if (c.results) {
        totalResults += c.results.length;
        totalSuccess += c.results.filter((r) => r.success).length;
      }
    }

    return {
      totalAccounts: accounts.length,
      totalContents: contents.length,
      totalCampaigns: campaigns.length,
      scheduledCount: scheduled.length,
      successRate: totalResults > 0 ? Math.round((totalSuccess / totalResults) * 100) : 0
    };
  });

  // ===== POSTS =====
  ipcMain.handle("posts:getAll", () => postService.getAll());
  ipcMain.handle("posts:delete", (_event, id) => postService.delete(id));
  ipcMain.handle("posts:getByCampaign", (_event, id) => postService.getByCampaignId(id));

  // ===== COMMENT CAMPAIGNS =====
  ipcMain.handle("commentCampaigns:getAll", () => commentCampaignService.getAll());
  ipcMain.handle("commentCampaigns:add", (_event, data) => commentCampaignService.add(data));
  ipcMain.handle("commentCampaigns:update", (_event, id, updates) => commentCampaignService.update(id, updates));
  ipcMain.handle("commentCampaigns:delete", (_event, id) => commentCampaignService.delete(id));

  ipcMain.handle("commentCampaigns:stop", (_event, id) => {
    const campaign = commentCampaignService.getById(id);
    if (!campaign) throw new Error("Comment campaign not found");
    commentCampaignService.update(id, { status: "stopped" });
    sendLog(`Đã dừng chiến dịch comment: ${campaign.name}`, "warning", id);
  });

  ipcMain.handle("commentCampaigns:run", async (_event, id) => {
    const campaign = commentCampaignService.getById(id);
    if (!campaign) throw new Error("Comment campaign not found");

    const posts = campaign.postIds
      .map((pid) => postService.getById(pid))
      .filter(Boolean)
      .map((p) => ({ id: p!.id, postUrl: p!.postUrl }));

    if (posts.length === 0) throw new Error("Không có bài đăng hợp lệ nào được chọn");

    commentCampaignService.update(id, { status: "running" });
    sendLog(`[Comment Campaign] Bắt đầu: ${campaign.name}`, "info", id);

    // Run asynchronously (non-blocking)
    (async () => {
      try {
        const results = await browserService.runCommentCampaign(
          campaign.accountId,
          posts,
          campaign.comments,
          campaign.delayBetweenComments || 3000,
          campaign.delayBetweenPosts || 5000,
          id
        );

        const currentCampaign = commentCampaignService.getById(id);
        if (currentCampaign?.status === "stopped") {
          commentCampaignService.update(id, { results, completedAt: new Date().toISOString() });
          return;
        }

        const hasFailures = results.some((r) => r.comments.some((c) => !c.success));
        commentCampaignService.update(id, {
          status: hasFailures ? "failed" : "completed",
          results,
          completedAt: new Date().toISOString()
        });

        const totalComments = results.reduce((s, r) => s + r.comments.length, 0);
        const successComments = results.reduce((s, r) => s + r.comments.filter((c) => c.success).length, 0);
        sendLog(
          `[Comment Campaign] Hoàn tất: ${successComments}/${totalComments} comment thành công`,
          hasFailures ? "warning" : "success",
          id
        );
      } catch (error: any) {
        const currentCampaign = commentCampaignService.getById(id);
        if (currentCampaign?.status !== "stopped") {
          commentCampaignService.update(id, { status: "failed", completedAt: new Date().toISOString() });
        }
        sendLog(`[Comment Campaign] Lỗi: ${error.message}`, "error", id);
      }
    })();
  });
  // ===== LICENSE =====
  ipcMain.handle("license:getInfo", () => licenseService.getLicenseInfo());

  ipcMain.handle("license:activate", (_event, key: string) => {
    try {
      return { success: true, data: licenseService.activate(key) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("license:deactivate", () => {
    licenseService.deactivate();
    return { success: true };
  });

  ipcMain.handle("license:getLimits", () => licenseService.getLimits());

  // ===== API FACEBOOK (Direct API) =====
  ipcMain.handle("apiFacebook:run", async (_event, params) => {
    try {
      const results = await runApiFacebookPosts(params);
      return { success: true, results };
    } catch (error: any) {
      sendLog(`[API Facebook] Lỗi: ${error.message}`, "error");
      return { success: false, error: error.message, results: [] };
    }
  });

  ipcMain.handle("apiFacebook:selectImage", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp", "bmp"] }]
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    
    const uploadsDir = store.getUploadsDir();
    const copiedPaths: string[] = [];
    
    for (const srcPath of result.filePaths) {
      if (srcPath.startsWith(uploadsDir)) {
        copiedPaths.push(srcPath);
        continue;
      }
      
      const ext = path.extname(srcPath);
      const baseName = path.basename(srcPath, ext);
      const destPath = path.join(uploadsDir, `${baseName}_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`);
      
      fs.copyFileSync(srcPath, destPath);
      copiedPaths.push(destPath);
    }
    return copiedPaths;
  });

  // ===== APP INFO =====
  ipcMain.handle("app:getVersion", () => app.getVersion());

  ipcMain.handle("app:checkForUpdates", async () => {
    try {
      const { autoUpdater } = await import("electron-updater");
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo ?? null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
