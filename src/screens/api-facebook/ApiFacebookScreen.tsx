import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/store";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Loader2,
  Play,
  RotateCcw,
  Trash2,
  XCircle,
  Zap
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

const formSchema = z
  .object({
    accountId: z.string().min(1, "Vui lòng chọn tài khoản"),
    message: z.string().min(1, "Nội dung không được để trống"),
    groupsText: z.string().min(1, "Vui lòng nhập ít nhất một Group URL"),
    delayMin: z.number().min(1, "Tối thiểu 1 giây"),
    delayMax: z.number().min(1, "Tối thiểu 1 giây")
  })
  .refine((data) => data.delayMax >= data.delayMin, {
    message: "Delay tối đa phải lớn hơn hoặc bằng delay tối thiểu",
    path: ["delayMax"]
  });

type FormValues = z.infer<typeof formSchema>;

interface PostResult {
  groupUrl: string;
  success: boolean;
  photoIds?: string[];
  error?: string;
}

interface RunState {
  status: "idle" | "running" | "done";
  results: PostResult[];
  error?: string;
}

export default function ApiFacebookScreen() {
  const { accounts, setAccounts } = useAppStore();

  const accountItems = accounts.map((account) => ({
    value: account.id,
    label: account.name
  }));

  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [runState, setRunState] = useState<RunState>({ status: "idle", results: [] });
  const stopRef = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountId: "",
      message: "",
      groupsText: "",
      delayMin: 3,
      delayMax: 5
    }
  });

  const { accountId, message, groupsText } = form.watch();
  const groupUrls = groupsText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const canRun = accountId && message.trim() && groupUrls.length > 0 && runState.status !== "running";

  useEffect(() => {
    if (!window.api) return;
    window.api.getAccounts().then(setAccounts).catch(console.error);
  }, [setAccounts]);

  const handleSelectImage = async () => {
    if (!window.api) return;
    try {
      const paths = await window.api.selectApiFacebookImage();
      if (paths && paths.length > 0) {
        setImagePaths((prev) => [...prev, ...paths]);
        toast.success(`Đã chọn thêm ${paths.length} ảnh`);
      }
    } catch (e: any) {
      toast.error("Không chọn được ảnh: " + e.message);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImagePaths((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: FormValues) => {
    if (!window.api) return;
    const groupUrls = values.groupsText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    stopRef.current = false;
    setRunState({ status: "running", results: [] });

    try {
      const res = await window.api.runApiFacebook({
        accountId: values.accountId,
        groupUrls,
        message: values.message.trim(),
        imagePaths: imagePaths.length > 0 ? imagePaths : undefined,
        delayMin: values.delayMin * 1000,
        delayMax: values.delayMax * 1000
      });

      setRunState({ status: "done", results: res.results || [] });

      if (res.success) {
        const ok = res.results.filter((r: any) => r.success).length;
        toast.success(`✅ Đã xong! Thành công ${ok}/${res.results.length}`);
      } else {
        setRunState((prev) => ({ ...prev, error: res.error }));
        toast.error("Lỗi: " + res.error);
      }
    } catch (e: any) {
      setRunState({ status: "done", results: [], error: e.message });
      toast.error("Lỗi: " + e.message);
    }
  };

  const handleReset = () => {
    setRunState({ status: "idle", results: [] });
    form.reset();
    setImagePaths([]);
  };

  const successCount = runState.results.filter((r) => r.success).length;
  const failCount = runState.results.filter((r) => !r.success).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="gradient-text text-[28px] font-extrabold tracking-tight">API Post</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Đăng bài trực tiếp qua Facebook GraphQL API — không cần mở trình duyệt
          </p>
        </div>
        {runState.status === "done" && (
          <Button variant="secondary" size="sm" onClick={handleReset}>
            <RotateCcw size={14} /> Làm mới
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* ── Left: Form ── */}
        <div className="space-y-4">
          <form id="form-api-post" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <Controller
                    control={form.control}
                    name="accountId"
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel>Tài khoản</FieldLabel>
                        <Select
                          items={accountItems}
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn tài khoản..." />
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
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 pt-6">
                  <Controller
                    control={form.control}
                    name="message"
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel>Nội dung bài đăng</FieldLabel>
                        <Textarea {...field} placeholder="Nhập nội dung..." rows={6} className="resize-none" />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />

                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleSelectImage}
                      disabled={runState.status === "running"}
                    >
                      <ImageIcon size={14} className="mr-2" /> Chọn ảnh
                    </Button>
                    <div className="flex flex-wrap gap-2">
                      {imagePaths.map((p, i) => (
                        <Badge key={i} variant="secondary" className="gap-2 px-3 py-1.5">
                          <span className="max-w-37.5 truncate text-xs">📎 {p.split(/[\\/]/).pop()}</span>
                          <Trash2
                            size={12}
                            className="hover:text-destructive cursor-pointer"
                            onClick={() => handleRemoveImage(i)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <Controller
                    control={form.control}
                    name="groupsText"
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel className="flex justify-between">
                          Danh sách Groups
                          <Badge variant="outline">
                            {field.value.split("\n").filter((l) => l.trim()).length} groups
                          </Badge>
                        </FieldLabel>
                        <Textarea
                          {...field}
                          placeholder="Mỗi group URL một dòng..."
                          rows={8}
                          className="font-mono text-xs"
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <button
                  type="button"
                  className="hover:bg-accent/40 flex w-full items-center justify-between p-4 text-sm font-medium transition-colors"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  <span className="flex items-center gap-2">
                    <Zap size={14} className="text-primary" /> Cài đặt nâng cao
                  </span>
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-4 border-t p-4">
                        <Controller
                          control={form.control}
                          name="delayMin"
                          render={({ field, fieldState }) => (
                            <Field>
                              <FieldLabel>Delay Min (s)</FieldLabel>
                              <Input type="number" {...field} />
                              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                            </Field>
                          )}
                        />
                        <Controller
                          control={form.control}
                          name="delayMax"
                          render={({ field, fieldState }) => (
                            <Field>
                              <FieldLabel>Delay Max (s)</FieldLabel>
                              <Input type="number" {...field} />
                              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                            </Field>
                          )}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>

              <Button type="submit" className="w-full" size="lg" disabled={!canRun}>
                {runState.status === "running" ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" /> Đang xử lý...
                  </>
                ) : (
                  <>
                    <Play size={18} className="mr-2" /> Bắt đầu đăng bài
                  </>
                )}
              </Button>
            </div>

            {/* ── Right Column: Results ── */}
            <div className="space-y-4">
              {runState.status !== "idle" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Kết quả</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {runState.status === "running" && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Tiến độ:</span>
                          <span>
                            {runState.results.length} /{" "}
                            {
                              form
                                .getValues("groupsText")
                                .split("\n")
                                .filter((l) => l.trim()).length
                            }
                          </span>
                        </div>
                        <div className="bg-secondary h-2 overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full transition-all"
                            style={{
                              width: `${
                                (runState.results.length /
                                  Math.max(
                                    1,
                                    form
                                      .getValues("groupsText")
                                      .split("\n")
                                      .filter((l) => l.trim()).length
                                  )) *
                                100
                              }%`
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {runState.status === "done" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-green-500/10 p-3 text-center text-green-500">
                          <p className="text-2xl font-bold">{successCount}</p>
                          <p className="text-[10px] uppercase">Thành công</p>
                        </div>
                        <div className="rounded-lg bg-red-500/10 p-3 text-center text-red-500">
                          <p className="text-2xl font-bold">{failCount}</p>
                          <p className="text-[10px] uppercase">Thất bại</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Chi tiết kết quả (giữ logic cũ của bạn) */}
              {runState.results.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Chi tiết</CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-96 space-y-2 overflow-y-auto">
                    {runState.results.map((r, i) => (
                      <div key={i} className="bg-secondary/50 flex items-center gap-2 rounded border p-2 text-xs">
                        {r.success ? (
                          <CheckCircle2 size={12} className="text-green-500" />
                        ) : (
                          <XCircle size={12} className="text-red-500" />
                        )}
                        <span className="flex-1 truncate">{r.groupUrl}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </form>
        </div>

        {/* ── Right: Results ── */}
        <div className="space-y-4">
          {/* Summary card */}
          {runState.status !== "idle" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Kết quả</CardTitle>
                </CardHeader>
                <CardContent>
                  {runState.status === "running" && (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <Loader2 size={32} className="text-primary animate-spin" />
                      <p className="text-muted-foreground text-sm">
                        Đang xử lý {runState.results.length}/{groupUrls.length} groups...
                      </p>
                      {/* Progress bar */}
                      <div className="bg-secondary h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{
                            width:
                              groupUrls.length > 0 ? `${(runState.results.length / groupUrls.length) * 100}%` : "0%"
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {runState.status === "done" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col items-center gap-1 rounded-xl bg-green-500/10 p-3 text-green-500">
                        <CheckCircle2 size={22} />
                        <span className="text-2xl font-bold">{successCount}</span>
                        <span className="text-xs opacity-80">Thành công</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-xl bg-red-500/10 p-3 text-red-500">
                        <XCircle size={22} />
                        <span className="text-2xl font-bold">{failCount}</span>
                        <span className="text-xs opacity-80">Thất bại</span>
                      </div>
                    </div>
                  )}

                  {runState.error && (
                    <div className="bg-destructive/10 text-destructive mt-3 flex items-start gap-2 rounded-lg p-3 text-xs">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      <span>{runState.error}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Result list */}
          {runState.results.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Chi tiết từng Group</CardTitle>
              </CardHeader>
              <CardContent className="max-h-130 space-y-2 overflow-y-auto pr-1">
                <AnimatePresence>
                  {runState.results.map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-border bg-secondary/50 flex items-start gap-2 rounded-lg border p-3"
                    >
                      <span className="mt-0.5 shrink-0">
                        {r.success ? (
                          <CheckCircle2 size={14} className="text-green-500" />
                        ) : (
                          <XCircle size={14} className="text-red-500" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{r.groupUrl}</p>
                        {r.error && <p className="text-destructive mt-0.5 text-[11px]">{r.error}</p>}
                        {r.photoIds && r.photoIds.length > 0 && (
                          <p className="text-muted-foreground mt-0.5 text-[11px]">Photo IDs: {r.photoIds.join(", ")}</p>
                        )}
                      </div>
                      <Badge
                        variant={r.success ? "default" : "destructive"}
                        className={`shrink-0 text-[10px] ${r.success ? "bg-green-500/20 text-green-500" : ""}`}
                      >
                        {r.success ? "OK" : "Lỗi"}
                      </Badge>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </CardContent>
            </Card>
          )}

          {/* Info card (idle) */}
          {runState.status === "idle" && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-10 text-center">
                <div className="bg-primary/10 mb-3 flex size-14 items-center justify-center rounded-2xl">
                  <Zap size={24} className="text-primary" />
                </div>
                <h3 className="mb-1 text-sm font-semibold">Direct API Post</h3>
                <p className="text-muted-foreground max-w-65 text-xs">
                  Tính năng này gọi trực tiếp GraphQL API của Facebook — nhanh hơn, không cần mở trình duyệt ẩn để điều
                  khiển UI.
                </p>
                <div className="text-muted-foreground mt-4 space-y-1.5 text-left text-xs">
                  <p>✅ Tận dụng cookies hiện có của account</p>
                  <p>✅ Delay 3–5 giây giữa các bài</p>
                  <p>✅ Hỗ trợ đăng kèm ảnh</p>
                  <p>⚡ Nhanh hơn automation thông thường</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
