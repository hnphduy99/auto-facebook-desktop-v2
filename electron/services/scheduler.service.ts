import { browserService } from "./browser.service.js";
import { campaignService } from "./campaign.service.js";
import { contentService } from "./content.service.js";
import { sendCampaignUpdate, sendLog } from "./utils.js";

/**
 * Scheduler service - checks for scheduled campaigns and triggers them
 */
export class SchedulerService {
  private static instance: SchedulerService;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private runningCampaigns = new Set<string>();

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  start(): void {
    if (this.intervalId) return;

    // Check every 30 seconds
    this.intervalId = setInterval(() => {
      this.checkSchedules();
    }, 30000);

    sendLog("Scheduler đã khởi động", "info");
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkSchedules(): Promise<void> {
    const scheduled = campaignService.getScheduled();
    const now = new Date();

    for (const campaign of scheduled) {
      if (!campaign.scheduledAt) continue;
      if (this.runningCampaigns.has(campaign.id)) continue;

      const scheduledTime = new Date(campaign.scheduledAt);
      if (scheduledTime <= now) {
        sendLog(`Thời gian đến! Đang khởi chạy chiến dịch: ${campaign.name}`, "info", campaign.id);
        this.runningCampaigns.add(campaign.id);

        try {
          campaignService.update(campaign.id, { status: "running" });
          sendCampaignUpdate(campaignService.getById(campaign.id));

          const content = contentService.getById(campaign.contentId);
          if (!content) {
            throw new Error("Content not found");
          }

          const results = await browserService.runCampaign(
            campaign.accountId,
            content.body,
            content.images,
            campaign.groups,
            campaign.maxConcurrent,
            campaign.id
          );

          const hasFailures = results.some((r) => !r.success);
          campaignService.update(campaign.id, {
            status: hasFailures ? "failed" : "completed",
            results,
            completedAt: new Date().toISOString()
          });

          sendLog(
            `Chiến dịch "${campaign.name}" hoàn tất: ${results.filter((r) => r.success).length}/${results.length} thành công`,
            hasFailures ? "warning" : "success",
            campaign.id
          );
          sendCampaignUpdate(campaignService.getById(campaign.id));
        } catch (error: any) {
          campaignService.update(campaign.id, {
            status: "failed",
            completedAt: new Date().toISOString()
          });
          sendLog(`Lỗi chiến dịch "${campaign.name}": ${error.message}`, "error", campaign.id);
        } finally {
          this.runningCampaigns.delete(campaign.id);
        }
      }
    }
  }

  schedule(campaignId: string, datetime: string): void {
    campaignService.update(campaignId, {
      status: "scheduled",
      scheduledAt: datetime
    });
    sendLog(`Đã lên lịch chiến dịch: ${datetime}`, "info", campaignId);
  }

  cancelSchedule(campaignId: string): void {
    campaignService.update(campaignId, {
      status: "draft",
      scheduledAt: undefined
    });
    sendLog("Đã hủy lịch chiến dịch", "info", campaignId);
  }
}
