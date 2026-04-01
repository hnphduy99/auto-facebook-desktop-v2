import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppStore } from "@/store";
import { CalendarDays, FileText, Plus, Rocket, Target, Users } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function DashboardScreen() {
  const { t, stats, setStats, campaigns, setCampaigns } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!window.api) return;
    try {
      const [statsData, campaignsData] = await Promise.all([window.api.getStats(), window.api.getCampaigns()]);
      setStats(statsData);
      setCampaigns(campaignsData);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    }
  };

  const recentCampaigns = campaigns
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const statusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed":
        return "default";
      case "running":
        return "secondary";
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: t.campaigns.statusDraft,
      running: t.campaigns.statusRunning,
      completed: t.campaigns.statusCompleted,
      failed: t.campaigns.statusFailed,
      scheduled: t.campaigns.statusScheduled
    };
    return labels[status] || status;
  };

  const statCards = [
    {
      icon: Users,
      value: stats.totalAccounts,
      label: t.dashboard.totalAccounts,
      gradient: "from-[#6c5ce7] to-[#a855f7]",
      iconBg: "bg-[#6c5ce7]/15",
      iconColor: "text-[#6c5ce7]"
    },
    {
      icon: FileText,
      value: stats.totalContents,
      label: t.dashboard.totalContents,
      gradient: "from-[#00cec9] to-[#0984e3]",
      iconBg: "bg-[#00cec9]/15",
      iconColor: "text-[#00cec9]"
    },
    {
      icon: Rocket,
      value: stats.totalCampaigns,
      label: t.dashboard.totalCampaigns,
      gradient: "from-[#fdcb6e] to-[#e17055]",
      iconBg: "bg-[#fdcb6e]/15",
      iconColor: "text-[#fdcb6e]"
    },
    {
      icon: CalendarDays,
      value: stats.scheduledCount,
      label: t.dashboard.scheduledCount,
      gradient: "from-[#74b9ff] to-[#0984e3]",
      iconBg: "bg-[#74b9ff]/15",
      iconColor: "text-[#74b9ff]"
    },
    {
      icon: Target,
      value: `${stats.successRate}%`,
      label: t.dashboard.successRate,
      gradient: "from-[#00b894] to-[#00cec9]",
      iconBg: "bg-[#00b894]/15",
      iconColor: "text-[#00b894]"
    }
  ];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="gradient-text text-[28px] font-extrabold tracking-tight">{t.dashboard.title}</h1>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="group relative h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className={`absolute top-0 right-0 left-0 h-0.75 bg-linear-to-r ${stat.gradient}`} />
              <CardContent className="p-6">
                <div className={`mb-4 flex size-12 items-center justify-center rounded-xl ${stat.iconBg}`}>
                  <Icon size={22} className={stat.iconColor} />
                </div>
                <div className="text-[32px] leading-none font-extrabold">{stat.value}</div>
                <div className="text-muted-foreground mt-1 text-[13px] font-medium">{stat.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h3 className="text-foreground mb-4 flex items-center gap-2 text-base font-bold">
          ⚡ {t.dashboard.quickActions}
        </h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <Button
            variant="outline"
            className="border-border bg-card hover:border-primary text-foreground h-auto justify-start gap-3 px-5 py-4 text-sm font-semibold transition-all hover:-translate-y-0.5"
            onClick={() => navigate("/campaigns")}
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#6c5ce7]/15">
              <Plus size={18} className="text-[#6c5ce7]" />
            </div>
            {t.dashboard.newCampaign}
          </Button>
          <Button
            variant="outline"
            className="border-border text-foreground bg-card hover:border-primary h-auto justify-start gap-3 px-5 py-4 text-sm font-semibold transition-all hover:-translate-y-0.5"
            onClick={() => navigate("/accounts")}
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#00cec9]/15">
              <Users size={18} className="text-[#00cec9]" />
            </div>
            {t.dashboard.addAccount}
          </Button>
          <Button
            variant="outline"
            className="border-border text-foreground bg-card hover:border-primary h-auto justify-start gap-3 px-5 py-4 text-sm font-semibold transition-all hover:-translate-y-0.5"
            onClick={() => navigate("/contents")}
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#fdcb6e]/15">
              <FileText size={18} className="text-[#fdcb6e]" />
            </div>
            {t.dashboard.createContent}
          </Button>
        </div>
      </div>

      {/* Recent Campaigns */}
      <div>
        <h3 className="text-foreground mb-4 flex items-center gap-2 text-base font-bold">
          📊 {t.dashboard.recentCampaigns}
        </h3>
        {recentCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-secondary text-muted-foreground mb-5 flex size-18 items-center justify-center rounded-2xl text-3xl">
              🚀
            </div>
            <p className="text-muted-foreground max-w-100 text-[15px]">{t.dashboard.noCampaigns}</p>
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.campaigns.name}</TableHead>
                  <TableHead>{t.campaigns.groups}</TableHead>
                  <TableHead>{t.campaigns.status}</TableHead>
                  <TableHead>{t.campaigns.results}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCampaigns.map((campaign) => {
                  const success = campaign.results?.filter((r) => r.success).length || 0;
                  const total = campaign.results?.length || 0;
                  return (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell className="text-muted-foreground">{campaign.groups.length} groups</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(campaign.status)}>{statusLabel(campaign.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{total > 0 ? `${success}/${total}` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
