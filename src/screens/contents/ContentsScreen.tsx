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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Content, useAppStore } from "@/store";
import { yupResolver } from "@hookform/resolvers/yup";
import dayjs from "dayjs";
import { CheckCircle, Edit, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as yup from "yup";

export default function ContentsScreen() {
  const { t, contents, setContents } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const contentSchema = yup.object({
    title: yup.string().required(t.validation.titleRequired),
    body: yup.string().required(t.validation.bodyRequired)
  });
  type ContentFormData = yup.InferType<typeof contentSchema>;

  const {
    register,
    handleSubmit: hookFormSubmit,
    reset,
    formState: { errors }
  } = useForm<ContentFormData>({
    resolver: yupResolver(contentSchema),
    defaultValues: { title: "", body: "" }
  });

  useEffect(() => {
    loadContents();
  }, []);

  const loadContents = async () => {
    if (!window.api) return;
    try {
      const data = await window.api.getContents();
      setContents(data);
    } catch (err) {
      console.error("[ContentsScreen] Failed to load:", err);
    }
  };

  const onSubmit = async (data: ContentFormData) => {
    if (!window.api) {
      toast.error("Electron API không khả dụng.");
      return;
    }
    setLoading(true);
    try {
      const payload = { ...data, images };
      if (editingContent) {
        await window.api.updateContent(editingContent.id, payload);
        toast.success("Cập nhật nội dung thành công!");
      } else {
        await window.api.addContent(payload);
        toast.success("Thêm nội dung thành công!");
      }
      closeModal();
      await loadContents();
    } catch (err: any) {
      toast.error(err?.message || "Có lỗi xảy ra khi lưu");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (content: Content) => {
    setEditingContent(content);
    reset({ title: content.title, body: content.body });
    setImages(content.images || []);
    setShowModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!window.api || !confirmDeleteId) return;
    await window.api.deleteContent(confirmDeleteId);
    setConfirmDeleteId(null);
    loadContents();
    toast.success("Đã xoá nội dung.");
  };

  const handleSelectImages = async () => {
    if (!window.api) return;
    const paths = await window.api.selectImages();
    if (paths.length > 0) setImages((prev) => [...prev, ...paths]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const openAddModal = () => {
    setEditingContent(null);
    reset({ title: "", body: "" });
    setImages([]);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingContent(null);
    reset({ title: "", body: "" });
    setImages([]);
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="gradient-text text-[28px] font-extrabold tracking-tight">{t.contents.title}</h1>
        <Button onClick={openAddModal}>
          <Plus size={16} />
          {t.contents.addNew}
        </Button>
      </div>

      {contents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="bg-secondary mb-5 flex size-18 items-center justify-center rounded-2xl text-3xl">📝</div>
          <p className="text-muted-foreground max-w-100 text-[15px]">{t.contents.noContents}</p>
          <Button className="mt-4" onClick={openAddModal}>
            <Plus size={16} />
            {t.contents.addNew}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {contents.map((content, idx) => (
              <motion.div
                key={content.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
              >
                <Card>
              <CardContent className="p-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-base font-bold uppercase">{content.title}</h3>
                  <div className="flex gap-2">
                    <Button size="icon" variant="secondary" className="size-8" onClick={() => handleEdit(content)}>
                      <Edit size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="border-destructive/20 bg-destructive/15 text-destructive hover:bg-destructive/25 size-8"
                      onClick={() => setConfirmDeleteId(content.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <p className="text-muted-foreground mb-2 max-h-28 overflow-auto text-sm">{content.body}</p>
                {content.images && content.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {content.images.map((imgPath, idx) => (
                      <img
                        key={idx}
                        src={`local://${encodeURIComponent(imgPath)}`}
                        alt={`img-${idx}`}
                        className="border-border size-20 rounded-lg border object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ))}
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      {content.images.length} {t.contents.images.toLowerCase()}
                    </span>
                  </div>
                )}
                <div className="mt-4 text-xs text-muted-foreground">
                  {dayjs(content.updatedAt).format("DD/MM/YYYY HH:mm:ss")}
                </div>
              </CardContent>
            </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Confirm Delete */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá nội dung</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xoá nội dung này không? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Xoá nội dung
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-160">
          <DialogHeader>
            <DialogTitle>{editingContent ? t.common.edit : t.contents.addNew}</DialogTitle>
          </DialogHeader>
          <form onSubmit={hookFormSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t.contents.titleField} *</Label>
              <Input
                {...register("title")}
                placeholder="Nội dung quảng cáo sản phẩm A"
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t.contents.body} *</Label>
              <Textarea
                {...register("body")}
                placeholder="Nội dung bài viết sẽ đăng lên Facebook..."
                rows={8}
                className={errors.body ? "border-destructive" : ""}
              />
              {errors.body && <p className="text-destructive text-xs">{errors.body.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t.contents.images}</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {images.map((filePath, index) => (
                  <div key={index} className="group relative">
                    <img
                      src={`local://${encodeURIComponent(filePath)}`}
                      alt={`upload-${index}`}
                      className="border-border size-20 rounded-xl border object-cover"
                      onError={(e) => {
                        const parent = e.currentTarget.parentElement!;
                        e.currentTarget.style.display = "none";
                        const fallback = parent.querySelector(".img-fallback") as HTMLElement;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                    <div className="img-fallback border-border bg-secondary text-muted-foreground hidden size-20 items-center justify-center rounded-xl border p-1 text-center text-[10px] leading-tight">
                      {filePath.split(/[/\\]/).pop()}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeImage(index)}
                      className="absolute inset-0 flex h-full w-full cursor-pointer items-center justify-center rounded-xl opacity-0 transition-opacity duration-150 hover:bg-destructive/80 group-hover:opacity-100"
                      style={{ background: "rgba(255,107,107,0.75)" }}
                    >
                      <X size={20} className="text-white" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-transparent p-0 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  onClick={handleSelectImages}
                >
                  <ImagePlus size={22} className="mb-1" />
                  <span className="text-[10px] font-medium leading-none">Thêm ảnh</span>
                </Button>
              </div>
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
    </div>
  );
}
