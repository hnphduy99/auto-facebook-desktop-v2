import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Campaign, useAppStore } from "@/store";
import { CalendarDays, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ScheduleScreen() {
  const { t, campaigns, setCampaigns } = useAppStore();
  const [scheduled, setScheduled] = useState<Campaign[]>([]);

  const loadData = async () => {
    if (!window.api) return;
    const all = await window.api.getCampaigns();
    setCampaigns(all);
    setScheduled(all.filter((c) => c.status === "scheduled" && c.scheduledAt));
  };

  const handleCancel = async (id: string) => {
    if (!window.api) return;
    await window.api.cancelSchedule(id);
    toast.success("Đã huỷ lịch chiến dịch.");
    loadData();
  };

  useEffect(() => { loadData(); }, [campaigns]);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="gradient-text text-[28px] font-extrabold tracking-tight">{t.schedule.title}</h1>
      </div>

      {scheduled.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-5 flex size-[72px] items-center justify-center rounded-2xl bg-secondary text-3xl">📅</div>
          <p className="text-[15px] text-muted-foreground">{t.schedule.noScheduled}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scheduled
            .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
            .map((campaign) => {
              const scheduledDate = new Date(campaign.scheduledAt!);
              const now = new Date();
              const isPast = scheduledDate < now;
              const diffMs = scheduledDate.getTime() - now.getTime();
              const diffMins = Math.max(0, Math.floor(diffMs / 60000));
              const diffHours = Math.floor(diffMins / 60);
              const remainingMins = diffMins % 60;

              let timeRemaining = "";
              if (isPast) timeRemaining = "⏰ Đang chờ xử lý...";
              else if (diffHours > 0) timeRemaining = `⏳ ${diffHours}h ${remainingMins}m`;
              else timeRemaining = `⏳ ${remainingMins}m`;

              return (
                <Card key={campaign.id}>
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[15px] font-semibold">
                        <CalendarDays size={16} className="mr-2 inline align-middle" />
                        {campaign.name}
                      </span>
                      <span className="text-[13px] font-medium text-[#00cec9]">
                        {dayjs(scheduledDate).format("DD/MM/YYYY HH:mm:ss")} — {timeRemaining}
                      </span>
                      <span className="mt-1 text-sm text-muted-foreground">
                        🔗 {campaign.groups.length} groups • ⚡ {campaign.maxConcurrent} concurrent
                      </span>
                    </div>
                    <Button size="sm" variant="destructive" onClick={() => handleCancel(campaign.id)}>
                      <X size={14} />
                      {t.schedule.cancel}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}
