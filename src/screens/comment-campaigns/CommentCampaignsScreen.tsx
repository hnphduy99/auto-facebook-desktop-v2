import { GradientButton } from "@/components/GradientButton";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CommentCampaign, useAppStore } from "@/store";
import { yupResolver } from "@hookform/resolvers/yup";
import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarCheck,
  CheckCircle,
  Edit,
  ExternalLink,
  ImagePlus,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  X,
  XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as yup from "yup";

const commentItemSchema = yup.object({
  text: yup.string().default(""),
  images: yup.array(yup.string().required()).default([])
});

const schema = yup.object({
  name: yup.string().required("Vui lòng nhập tên chiến dịch"),
  accountId: yup.string().required("Vui lòng chọn tài khoản"),
  comments: yup
    .array(commentItemSchema)
    .min(1, "Phải có ít nhất 1 comment")
    .test(
      "has-content",
      "Ít nhất 1 comment phải có nội dung",
      (arr) => arr?.some((c) => (c.text?.trim() ?? "") !== "" || (c.images?.length ?? 0) > 0) ?? false
    )
    .required(),
  postIds: yup.array(yup.string().required()).min(1, "Vui lòng chọn ít nhất 1 bài đăng").required(),
  delayBetweenComments: yup.number().min(1).max(60).default(3).required(),
  delayBetweenPosts: yup.number().min(1).max(120).default(5).required()
});

type FormData = yup.InferType<typeof schema>;

function statusBadge(status: CommentCampaign["status"]) {
  const map: Record<
    string,
    { variant: "default" | "secondary" | "destructive" | "outline"; label: string; className?: string }
  > = {
    draft: { variant: "secondary", label: "Nháp" },
    running: { variant: "outline", label: "Đang chạy", className: "border-info/30 bg-info/15 text-info" },
    completed: { variant: "default", label: "Hoàn thành", className: "bg-success text-success-foreground" },
    failed: { variant: "destructive", label: "Thất bại" },
    stopped: { variant: "secondary", label: "Đã dừng" }
  };
  return map[status] ?? { variant: "secondary" as const, label: status };
}

export default function CommentCampaignsScreen() {
  const { t, commentCampaigns, setCommentCampaigns, posts, setPosts, accounts, setAccounts } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CommentCampaign | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<CommentCampaign | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmStopId, setConfirmStopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors }
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      name: "",
      accountId: "",
      comments: [{ text: "", images: [] }],
      postIds: [],
      delayBetweenComments: 3,
      delayBetweenPosts: 5
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "comments" });
  const watchedPostIds = watch("postIds");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!window.api) return;
    try {
      const [camps, postsData, accs] = await Promise.all([
        window.api.getCommentCampaigns(),
        window.api.getPosts(),
        window.api.getAccounts()
      ]);
      setCommentCampaigns(camps);
      setPosts(postsData);
      setAccounts(accs);
    } catch (error: any) {
      toast.error("Lỗi tải dữ liệu: " + error.message);
    }
  };

  const openAddModal = () => {
    setEditingCampaign(null);
    reset({
      name: "",
      accountId: accounts[0]?.id || "",
      comments: [{ text: "", images: [] }],
      postIds: [],
      delayBetweenComments: 3,
      delayBetweenPosts: 5
    });
    setShowModal(true);
  };

  const openEditModal = (campaign: CommentCampaign) => {
    setEditingCampaign(campaign);
    reset({
      name: campaign.name,
      accountId: campaign.accountId,
      comments: campaign.comments.map((c) => ({ text: c.text, images: [...c.images] })),
      postIds: [...campaign.postIds],
      delayBetweenComments: campaign.delayBetweenComments / 1000,
      delayBetweenPosts: campaign.delayBetweenPosts / 1000
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCampaign(null);
    reset();
  };

  const onSubmit = async (data: FormData) => {
    if (!window.api) return;
    setLoading(true);
    try {
      const payload = {
        name: data.name,
        accountId: data.accountId,
        comments: data.comments
          .filter((c) => c.text.trim() || c.images.length > 0)
          .map((c) => ({ text: c.text, images: c.images as string[] })),
        postIds: data.postIds as string[],
        delayBetweenComments: data.delayBetweenComments * 1000,
        delayBetweenPosts: data.delayBetweenPosts * 1000
      };
      if (editingCampaign) {
        await window.api.updateCommentCampaign(editingCampaign.id, payload);
        toast.success("Cập nhật chiến dịch comment thành công!");
      } else {
        await window.api.addCommentCampaign(payload);
        toast.success("Tạo chiến dịch comment thành công!");
      }
      closeModal();
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const handleRun = (id: string) => {
    if (!window.api) return;
    toast.success("Đã khởi động chiến dịch comment!");
    window.api.runCommentCampaign(id).catch(console.error);
  };
  const handleStopConfirm = async () => {
    if (!window.api || !confirmStopId) return;
    const id = confirmStopId;
    setConfirmStopId(null);
    await window.api.stopCommentCampaign(id);
    toast.success("Đã dừng chiến dịch comment.");
    loadData();
  };
  const handleDeleteConfirm = async () => {
    if (!window.api || !confirmDeleteId) return;
    await window.api.deleteCommentCampaign(confirmDeleteId);
    setConfirmDeleteId(null);
    loadData();
    toast.success("Đã xoá chiến dịch comment.");
  };

  const togglePost = (postId: string) => {
    const current = watchedPostIds ?? [];
    const next = current.includes(postId) ? current.filter((id) => id !== postId) : [...current, postId];
    setValue("postIds", next, { shouldValidate: true });
  };
  const toggleAllPosts = () => {
    const current = watchedPostIds ?? [];
    setValue("postIds", current.length === posts.length ? [] : posts.map((p) => p.id), { shouldValidate: true });
  };

  const addImages = async (idx: number) => {
    if (!window.api) return;
    try {
      const paths = await window.api.selectImages();
      if (paths.length > 0) {
        const current: string[] = watch(`comments.${idx}.images`) ?? [];
        setValue(`comments.${idx}.images`, [...current, ...paths]);
      }
    } catch {
      toast.error("Lỗi chọn ảnh");
    }
  };
  const removeImage = (commentIdx: number, imgIdx: number) => {
    const current: string[] = watch(`comments.${commentIdx}.images`) ?? [];
    setValue(
      `comments.${commentIdx}.images`,
      current.filter((_, i) => i !== imgIdx)
    );
  };

  const getAccountName = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    return acc ? acc.name || acc.email : "—";
  };
  const getPostById = (id: string) => posts.find((p) => p.id === id);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="gradient-text text-[28px] font-extrabold tracking-tight">{t.commentCampaigns.title}</h1>
        <GradientButton onClick={openAddModal}>
          <Plus size={16} />
          {t.commentCampaigns.addNew}
        </GradientButton>
      </div>

      {commentCampaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="bg-secondary mb-5 flex size-18 items-center justify-center rounded-2xl text-3xl">💬</div>
          <p className="text-muted-foreground max-w-100 text-[15px]">{t.commentCampaigns.noCampaigns}</p>
          <GradientButton className="mt-4" onClick={openAddModal}>
            <Plus size={16} />
            {t.commentCampaigns.addNew}
          </GradientButton>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {commentCampaigns
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((campaign, idx) => {
                const badge = statusBadge(campaign.status);
                const totalComments = campaign.results?.reduce((s, r) => s + r.comments.length, 0) ?? 0;
                const successComments =
                  campaign.results?.reduce((s, r) => s + r.comments.filter((c) => c.success).length, 0) ?? 0;
                return (
                  <motion.div
                    key={campaign.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: idx * 0.05 }}
                  >
                    <Card className="transition-all hover:shadow-lg">
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
                          <span>💬 {campaign.comments.length} comment</span>
                          <span>📋 {campaign.postIds.length} bài đăng</span>
                          {totalComments > 0 && (
                            <span>
                              ✅ {successComments}/{totalComments}
                            </span>
                          )}
                          {campaign.completedAt && (
                            <span>🕐 {dayjs(campaign.completedAt).format("DD/MM/YYYY HH:mm:ss")}</span>
                          )}
                        </div>
                        <div className="border-border mt-4 flex gap-2 border-t pt-4">
                          {["draft", "failed", "stopped", "completed"].includes(campaign.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-success/20 bg-success/15 text-success hover:bg-success/25"
                              onClick={() => handleRun(campaign.id)}
                            >
                              {campaign.status === "completed" ? <RefreshCw size={14} /> : <Play size={14} />}
                              {campaign.status === "completed" ? t.commentCampaigns.rerun : t.commentCampaigns.run}
                            </Button>
                          )}
                          {campaign.status === "running" && (
                            <Button size="sm" variant="destructive" onClick={() => setConfirmStopId(campaign.id)}>
                              <Square size={14} />
                              {t.commentCampaigns.stop}
                            </Button>
                          )}
                          {campaign.results && campaign.results.length > 0 && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedCampaign(campaign);
                                setShowResultsModal(true);
                              }}
                            >
                              <CalendarCheck size={14} />
                              {t.commentCampaigns.viewResults}
                            </Button>
                          )}
                          <div className="flex-1" />
                          <Button
                            size="icon"
                            variant="secondary"
                            className="size-8"
                            onClick={() => openEditModal(campaign)}
                          >
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
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      )}

      {/* Confirm Delete */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá chiến dịch comment</AlertDialogTitle>
            <AlertDialogDescription>Bạn có chắc chắn muốn xoá chiến dịch comment này?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Stop */}
      <AlertDialog open={!!confirmStopId} onOpenChange={() => setConfirmStopId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dừng chiến dịch</AlertDialogTitle>
            <AlertDialogDescription>Bạn có chắc muốn dừng chiến dịch comment đang chạy này?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleStopConfirm}>Dừng ngay</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={closeModal} disablePointerDismissal>
        <DialogContent className="max-h-[90vh] max-w-175 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? t.common.edit : t.commentCampaigns.addNew}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>{t.commentCampaigns.name} *</Label>
              <Input
                {...register("name")}
                placeholder="Comment sale tháng 3..."
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
            {/* Account */}
            <div className="space-y-2">
              <Label>{t.commentCampaigns.account} *</Label>
              <Controller
                name="accountId"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className={errors.accountId ? "border-destructive" : ""}>
                      <SelectValue placeholder="-- Chọn tài khoản --" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name || a.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.accountId && <p className="text-destructive text-xs">{errors.accountId.message}</p>}
            </div>
            {/* Comments */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>💬 {t.commentCampaigns.commentContent} *</Label>
                <Button type="button" size="sm" variant="secondary" onClick={() => append({ text: "", images: [] })}>
                  <Plus size={14} />
                  {t.commentCampaigns.addComment}
                </Button>
              </div>
              {(errors.comments as any)?.message && (
                <p className="text-destructive text-xs">{(errors.comments as any).message}</p>
              )}
              <div className="space-y-3">
                {fields.map((field, idx) => {
                  const watchedImages: string[] = watch(`comments.${idx}.images`) ?? [];
                  return (
                    <Card key={field.id} className="p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-muted-foreground text-xs font-medium">Comment #{idx + 1}</span>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="size-6"
                            onClick={() => remove(idx)}
                          >
                            <Trash2 size={12} />
                          </Button>
                        )}
                      </div>
                      <Textarea
                        rows={3}
                        placeholder={t.commentCampaigns.commentContent}
                        {...register(`comments.${idx}.text`)}
                        className={(errors.comments as any)?.[idx]?.text ? "border-destructive" : ""}
                      />
                      <div className="mt-2 space-y-1">
                        <Label className="text-xs">🖼️ {t.commentCampaigns.commentImages}</Label>
                        <div className="flex flex-wrap gap-2">
                          {watchedImages.map((filePath, ii) => (
                            <div key={ii} className="group relative">
                              <img
                                src={`local://${encodeURIComponent(filePath)}`}
                                alt={`c${idx}-img${ii}`}
                                className="border-border size-20 rounded-xl border object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const f = e.currentTarget.parentElement?.querySelector(".img-fb") as HTMLElement;
                                  if (f) f.style.display = "flex";
                                }}
                              />
                              <div className="img-fb border-border bg-secondary text-muted-foreground hidden size-20 items-center justify-center rounded-xl border p-1 text-center text-[10px]">
                                {filePath.split(/[/\\]/).pop()}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeImage(idx, ii)}
                                className="hover:bg-destructive/80 absolute inset-0 flex h-full w-full cursor-pointer items-center justify-center rounded-xl opacity-0 transition-opacity group-hover:opacity-100"
                                style={{ background: "rgba(255,107,107,0.75)" }}
                              >
                                <X size={20} className="text-white" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            className="border-border text-muted-foreground hover:border-primary hover:text-primary flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed bg-transparent p-0 transition-colors"
                            onClick={() => addImages(idx)}
                          >
                            <ImagePlus size={22} className="mb-1" />
                            <span className="text-[10px] leading-none font-medium">Thêm ảnh</span>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
            {/* Delay settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  ⏱️ {t.commentCampaigns.delayComments} ({t.commentCampaigns.seconds})
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  {...register("delayBetweenComments")}
                  className={errors.delayBetweenComments ? "border-destructive" : ""}
                />
                {errors.delayBetweenComments && (
                  <p className="text-destructive text-xs">{errors.delayBetweenComments.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  ⏱️ {t.commentCampaigns.delayPosts} ({t.commentCampaigns.seconds})
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  {...register("delayBetweenPosts")}
                  className={errors.delayBetweenPosts ? "border-destructive" : ""}
                />
                {errors.delayBetweenPosts && (
                  <p className="text-destructive text-xs">{errors.delayBetweenPosts.message}</p>
                )}
              </div>
            </div>
            {/* Select posts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  📋 {t.commentCampaigns.selectPosts} * ({(watchedPostIds ?? []).length}/{posts.length})
                </Label>
                <Button type="button" size="sm" variant="secondary" onClick={toggleAllPosts}>
                  {(watchedPostIds ?? []).length === posts.length ? "Bỏ chọn tất cả" : t.commentCampaigns.selectAll}
                </Button>
              </div>
              {(errors.postIds as any)?.message && (
                <p className="text-destructive text-xs">{(errors.postIds as any).message}</p>
              )}
              {posts.length === 0 ? (
                <div className="border-border text-muted-foreground rounded-lg border p-3 text-sm italic">
                  Chưa có bài đăng nào. Hãy chạy chiến dịch đăng bài trước!
                </div>
              ) : (
                <ScrollArea className="border-border h-60 rounded-lg border p-1.5">
                  {posts.map((post) => (
                    <label
                      key={post.id}
                      className="hover:bg-accent flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary mt-0.5 shrink-0"
                        checked={(watchedPostIds ?? []).includes(post.id)}
                        onChange={() => togglePost(post.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-primary truncate text-[13px] font-medium">{post.postUrl}</div>
                        <div className="text-muted-foreground text-xs">
                          📌 {post.campaignName} · 📅 {dayjs(post.postedAt).format("DD/MM/YYYY HH:mm:ss")}
                        </div>
                        <div className="text-muted-foreground truncate text-xs italic">"{post.contentSnippet}"</div>
                      </div>
                    </label>
                  ))}
                </ScrollArea>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={closeModal} disabled={loading}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={loading} className="min-w-30">
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
          </form>
        </DialogContent>
      </Dialog>

      {/* Results Modal */}
      <Dialog open={showResultsModal} onOpenChange={() => setShowResultsModal(false)} disablePointerDismissal>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t.commentCampaigns.viewResults}: {selectedCampaign?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedCampaign?.results?.map((result, ri) => {
              const post = getPostById(result.postId);
              const successCount = result.comments.filter((c) => c.success).length;
              return (
                <Card key={ri}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between">
                      <a
                        href={result.postUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary inline-flex items-center gap-1 text-[13px] hover:underline"
                      >
                        <ExternalLink size={13} />
                        {result.postUrl}
                      </a>
                      <Badge
                        variant={successCount === result.comments.length ? "default" : "destructive"}
                        className={successCount === result.comments.length ? "bg-success text-success-foreground" : ""}
                      >
                        {successCount}/{result.comments.length}
                      </Badge>
                    </div>
                    {post && <div className="text-muted-foreground text-xs">📌 {post.campaignName}</div>}
                    <div className="space-y-1">
                      {result.comments.map((c, ci) => (
                        <div key={ci} className="flex items-center gap-2 text-[13px]">
                          {c.success ? (
                            <CheckCircle size={14} className="text-success shrink-0" />
                          ) : (
                            <XCircle size={14} className="text-destructive shrink-0" />
                          )}
                          <span>
                            Comment #{c.index + 1}: {c.success ? "Thành công" : c.error || "Thất bại"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
