import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Campaign, useAppStore } from "@/store";
import { yupResolver } from "@hookform/resolvers/yup";
import dayjs from "dayjs";
import { CalendarDays, CheckCircle, Edit, Loader2, Play, Plus, RefreshCw, Square, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as yup from "yup";

export default function CampaignsScreen() {
  const { t, campaigns, setCampaigns, accounts, setAccounts, contents, setContents, accountItems } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmStopId, setConfirmStopId] = useState<string | null>(null);

  const campaignSchema = yup.object({
    name: yup.string().required(t.validation.nameRequired),
    accountId: yup.string().required(t.validation.accountSelect),
    contentId: yup.string().required(t.validation.contentSelect),
    groups: yup
      .string()
      .required(t.validation.groupsRequired)
      .test("has-urls", t.validation.groupsRequired, (v) => {
        if (!v) return false;
        return v.split("\n").filter((l) => l.trim().length > 0).length > 0;
      }),
    maxConcurrent: yup
      .number()
      .required()
      .min(1, t.validation.maxConcurrentMin)
      .max(4, t.validation.maxConcurrentMax)
      .default(2)
  });
  type CampaignFormData = yup.InferType<typeof campaignSchema>;

  const {
    handleSubmit,
    reset,
    control,
    formState: { errors }
  } = useForm<CampaignFormData>({
    resolver: yupResolver(campaignSchema),
    defaultValues: { name: "", accountId: "", contentId: "", groups: "", maxConcurrent: 2 }
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!window.api) return;
    const [c, a, ct] = await Promise.all([
      window.api.getCampaigns(),
      window.api.getAccounts(),
      window.api.getContents()
    ]);
    setCampaigns(c);
    setAccounts(a);
    setContents(ct);
  };

  const onSubmit = async (data: CampaignFormData) => {
    if (!window.api) {
      toast.error("Electron API không khả dụng.");
      return;
    }
    setLoading(true);
    try {
      const groups = data.groups
        .split("\n")
        .map((g) => g.trim())
        .filter((g) => g.length > 0);
      const payload = {
        name: data.name,
        accountId: data.accountId,
        contentId: data.contentId,
        groups,
        maxConcurrent: data.maxConcurrent
      };
      if (editingCampaign) {
        await window.api.updateCampaign(editingCampaign.id, payload);
        toast.success("Cập nhật chiến dịch thành công!");
      } else {
        await window.api.addCampaign(payload);
        toast.success("Tạo chiến dịch thành công!");
      }
      closeModal();
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (c: Campaign) => {
    setEditingCampaign(c);
    reset({
      name: c.name,
      accountId: c.accountId,
      contentId: c.contentId,
      groups: c.groups.join("\n"),
      maxConcurrent: c.maxConcurrent
    });
    setShowModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!window.api || !confirmDeleteId) return;
    await window.api.deleteCampaign(confirmDeleteId);
    setConfirmDeleteId(null);
    loadData();
    toast.success("Đã xoá chiến dịch.");
  };
  const handleStopConfirm = async () => {
    if (!window.api || !confirmStopId) return;
    const id = confirmStopId;
    setConfirmStopId(null);
    await window.api.stopCampaign(id);
    toast.success("Đã dừng chiến dịch.");
  };
  const handleRun = (id: string) => {
    if (!window.api) return;
    toast.success("Đã khởi động tiến trình đăng bài!");
    window.api.runCampaign(id).catch(console.error);
  };
  const openScheduleModal = (c: Campaign) => {
    setSelectedCampaign(c);
    setScheduleDate(c.scheduledAt || "");
    setShowScheduleModal(true);
  };
  const handleSchedule = async () => {
    if (!window.api || !selectedCampaign || !scheduleDate) return;
    await window.api.scheduleCampaign(selectedCampaign.id, scheduleDate);
    toast.success("Đã đặt lịch chiến dịch!");
    setShowScheduleModal(false);
    loadData();
  };
  const openResultsModal = (c: Campaign) => {
    setSelectedCampaign(c);
    setShowResultsModal(true);
  };
  const openAddModal = () => {
    setEditingCampaign(null);
    reset({ name: "", accountId: "", contentId: "", groups: "", maxConcurrent: 2 });
    setShowModal(true);
  };
  const closeModal = () => {
    setShowModal(false);
    setEditingCampaign(null);
    reset();
  };

  const statusBadge = (status: string) => {
    const map: Record<
      string,
      { variant: "default" | "secondary" | "destructive" | "outline"; label: string; className?: string }
    > = {
      draft: { variant: "secondary", label: t.campaigns.statusDraft },
      running: {
        variant: "outline",
        label: t.campaigns.statusRunning,
        className: "border-info/30 bg-info/15 text-info"
      },
      completed: {
        variant: "default",
        label: t.campaigns.statusCompleted,
        className: "bg-success text-success-foreground"
      },
      failed: { variant: "destructive", label: t.campaigns.statusFailed },
      scheduled: {
        variant: "outline",
        label: t.campaigns.statusScheduled,
        className: "border-warning/30 bg-warning/15 text-warning"
      },
      stopped: { variant: "secondary", label: t.campaigns.statusStopped }
    };
    return map[status] || { variant: "secondary" as const, label: status };
  };

  const getAccountName = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    return acc ? acc.name || acc.email : "—";
  };
  const getContentTitle = (id: string) => {
    const ct = contents.find((c) => c.id === id);
    return ct ? ct.title : "—";
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="gradient-text text-[28px] font-extrabold tracking-tight">{t.campaigns.title}</h1>
        <Button onClick={openAddModal}>
          <Plus size={16} />
          {t.campaigns.addNew}
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="bg-secondary mb-5 flex size-18 items-center justify-center rounded-2xl text-3xl">🚀</div>
          <p className="text-muted-foreground max-w-100 text-[15px]">{t.campaigns.noCampaigns}</p>
          <Button className="mt-4" onClick={openAddModal}>
            <Plus size={16} />
            {t.campaigns.addNew}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((campaign) => {
              const badge = statusBadge(campaign.status);
              const successCount = campaign.results?.filter((r) => r.success).length || 0;
              const totalCount = campaign.results?.length || 0;
              return (
                <Card key={campaign.id} className="transition-all hover:shadow-lg">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-base font-bold">{campaign.name}</span>
                      <Badge variant={badge.variant} className={badge.className}>
                        {campaign.status === "running" && <Loader2 size={12} className="animate-spin" />}
                        {badge.label}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground flex flex-wrap gap-5 text-[13px]">
                      <span>👤 {getAccountName(campaign.accountId)}</span>
                      <span>📝 {getContentTitle(campaign.contentId)}</span>
                      <span>🔗 {campaign.groups.length} groups</span>
                      <span>
                        ⚡ {campaign.maxConcurrent} {t.campaigns.maxConcurrent.toLowerCase()}
                      </span>
                      {totalCount > 0 && (
                        <span>
                          ✅ {successCount}/{totalCount}
                        </span>
                      )}
                      {campaign.scheduledAt && (
                        <span>📅 {dayjs(campaign.scheduledAt).format("DD/MM/YYYY HH:mm:ss")}</span>
                      )}
                    </div>
                    <div className="border-border mt-4 flex gap-2 border-t pt-4">
                      {(campaign.status === "draft" ||
                        campaign.status === "failed" ||
                        campaign.status === "stopped" ||
                        campaign.status === "completed") && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-success/20 bg-success/15 text-success hover:bg-success/25"
                            onClick={() => handleRun(campaign.id)}
                          >
                            {campaign.status === "completed" ? <RefreshCw size={14} /> : <Play size={14} />}
                            {campaign.status === "completed" ? t.campaigns.rerun : t.campaigns.run}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => openScheduleModal(campaign)}>
                            <CalendarDays size={14} />
                            {t.campaigns.schedule}
                          </Button>
                        </>
                      )}
                      {campaign.status === "running" && (
                        <Button size="sm" variant="destructive" onClick={() => setConfirmStopId(campaign.id)}>
                          <Square size={14} />
                          {t.campaigns.stop}
                        </Button>
                      )}
                      {campaign.status === "scheduled" && (
                        <Button size="sm" variant="destructive" onClick={() => setConfirmStopId(campaign.id)}>
                          <X size={14} />
                          {t.schedule.cancel}
                        </Button>
                      )}
                      {campaign.results && campaign.results.length > 0 && (
                        <Button size="sm" variant="secondary" onClick={() => openResultsModal(campaign)}>
                          {t.campaigns.viewResults}
                        </Button>
                      )}
                      <div className="flex-1" />
                      <Button size="icon" variant="secondary" className="size-8" onClick={() => handleEdit(campaign)}>
                        <Edit size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="border-destructive/20 bg-destructive/15 text-destructive hover:bg-destructive/25 size-8"
                        onClick={() => setConfirmDeleteId(campaign.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {/* Confirm Delete */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá chiến dịch</AlertDialogTitle>
            <AlertDialogDescription>Bạn có chắc chắn muốn xoá chiến dịch này không?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Xoá chiến dịch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Stop */}
      <AlertDialog open={!!confirmStopId} onOpenChange={() => setConfirmStopId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dừng chiến dịch</AlertDialogTitle>
            <AlertDialogDescription>Bạn có chắc muốn dừng chiến dịch đang chạy này?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleStopConfirm}>Dừng ngay</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? t.common.edit : t.campaigns.addNew}</DialogTitle>
            <Separator className="mt-2" />
          </DialogHeader>
          <div className="-mx-4 max-h-[50vh] overflow-y-auto px-4">
            <form id="campaign-form" className="py-4" onSubmit={handleSubmit(onSubmit)}>
              <FieldGroup>
                <Controller
                  name="name"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>{t.campaigns.name} *</FieldLabel>
                      <Input
                        {...field}
                        placeholder="Chiến dịch tháng 2"
                        className={fieldState.invalid ? "border-destructive" : ""}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="accountId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>{t.campaigns.account} *</FieldLabel>
                      <Select items={accountItems} onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className={errors.accountId ? "border-destructive" : ""}>
                          <SelectValue placeholder={t.campaigns.selectAccount} />
                        </SelectTrigger>
                        <SelectContent>
                          {accountItems.map((acc) => (
                            <SelectItem key={acc.value} value={acc.value}>
                              {acc.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="contentId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>{t.campaigns.content} *</FieldLabel>
                      <Select
                        items={contents.map((ct) => ({ value: ct.id, label: ct.title }))}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger className={errors.contentId ? "border-destructive" : ""}>
                          <SelectValue placeholder={t.campaigns.selectContent} />
                        </SelectTrigger>
                        <SelectContent>
                          {contents.map((ct) => (
                            <SelectItem key={ct.id} value={ct.id}>
                              {ct.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="groups"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>{t.campaigns.groups} *</FieldLabel>
                      <Textarea
                        {...field}
                        placeholder={t.campaigns.groupsPlaceholder}
                        rows={6}
                        className={cn("min-h-24", fieldState.invalid ? "border-destructive" : "")}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="maxConcurrent"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>{t.campaigns.maxConcurrent}</FieldLabel>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        max={3}
                        className={fieldState.invalid ? "border-destructive" : ""}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </FieldGroup>
            </form>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={loading}>
              {t.common.cancel}
            </Button>
            <Button form="campaign-form" type="submit" disabled={loading} className="min-w-30">
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t.common.loading}
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  {t.common.save}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Modal */}
      <Dialog open={showScheduleModal} onOpenChange={() => setShowScheduleModal(false)}>
        <DialogContent className="max-w-100">
          <DialogHeader>
            <DialogTitle>{t.schedule.setSchedule}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.schedule.datetime}</Label>
              <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>
                {t.common.cancel}
              </Button>
              <Button onClick={handleSchedule}>
                <CalendarDays size={16} />
                {t.schedule.setSchedule}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Results Modal */}
      <Dialog open={showResultsModal} onOpenChange={() => setShowResultsModal(false)}>
        <DialogContent className="max-w-150">
          <DialogHeader>
            <DialogTitle>
              {t.campaigns.results}: {selectedCampaign?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-75 space-y-2 overflow-y-auto">
            {selectedCampaign?.results?.map((result, i) => (
              <div key={i} className="bg-secondary flex items-center justify-between rounded-lg p-3 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground max-w-75 truncate font-medium">{result.groupUrl}</span>
                  {result.postUrl && (
                    <a
                      href={result.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-xs hover:underline"
                    >
                      🔗 Đi đến bài viết
                    </a>
                  )}
                </div>
                <Badge
                  variant={result.success ? "default" : "destructive"}
                  className={result.success ? "bg-success text-success-foreground" : ""}
                >
                  {result.success ? t.campaigns.success : t.campaigns.failed}
                </Badge>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
