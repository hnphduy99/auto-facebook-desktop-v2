import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/store";
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
import { toast } from "sonner";

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

const DEFAULT_DELAY_MIN = 5;
const DEFAULT_DELAY_MAX = 10;

export default function ApiFacebookScreen() {
  const { accounts, setAccounts } = useAppStore();

  const [accountId, setAccountId] = useState("");
  const [message, setMessage] = useState("");
  const [groupsText, setGroupsText] = useState("");
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [delayMin, setDelayMin] = useState(DEFAULT_DELAY_MIN);
  const [delayMax, setDelayMax] = useState(DEFAULT_DELAY_MAX);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [runState, setRunState] = useState<RunState>({ status: "idle", results: [] });
  const stopRef = useRef(false);

  useEffect(() => {
    if (!window.api) return;
    window.api.getAccounts().then(setAccounts).catch(console.error);
  }, [setAccounts]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const groupUrls = groupsText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const canRun = accountId && message.trim() && groupUrls.length > 0 && runState.status !== "running";

  // ── Handlers ─────────────────────────────────────────────────────────────

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

  const handleRun = async () => {
    if (!window.api) {
      toast.error("Electron API không khả dụng.");
      return;
    }
    if (!canRun) return;

    stopRef.current = false;
    setRunState({ status: "running", results: [] });

    try {
      const res = await window.api.runApiFacebook({
        accountId,
        groupUrls,
        message: message.trim(),
        imagePaths: imagePaths.length > 0 ? imagePaths : undefined,
        delayMin: delayMin * 1000,
        delayMax: delayMax * 1000
      });

      if (res.success) {
        setRunState({ status: "done", results: res.results });
        const ok = res.results.filter((r) => r.success).length;
        if (ok === res.results.length) toast.success(`✅ Đăng thành công ${ok}/${res.results.length} groups!`);
        else toast.warning(`⚠️ ${ok}/${res.results.length} thành công, ${res.results.length - ok} thất bại`);
      } else {
        setRunState({ status: "done", results: res.results ?? [], error: res.error });
        toast.error("Lỗi: " + res.error);
      }
    } catch (e: any) {
      setRunState({ status: "done", results: [], error: e.message });
      toast.error("Lỗi không mong muốn: " + e.message);
    }
  };

  const handleReset = () => {
    setRunState({ status: "idle", results: [] });
  };

  // ── Stats ─────────────────────────────────────────────────────────────────

  const successCount = runState.results.filter((r) => r.success).length;
  const failCount = runState.results.filter((r) => !r.success).length;

  // ── Render ────────────────────────────────────────────────────────────────

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
          {/* Account */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Tài khoản</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={accountId} onValueChange={(val) => setAccountId(val as string)}>
                <SelectTrigger id="api-account-select">
                  <SelectValue placeholder="Chọn tài khoản..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full ${
                            acc.status === "active"
                              ? "bg-green-500"
                              : acc.status === "error"
                                ? "bg-red-500"
                                : "bg-gray-400"
                          }`}
                        />
                        {acc.name || acc.email}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {accounts.length === 0 && (
                <p className="text-muted-foreground mt-2 text-xs">
                  Chưa có tài khoản nào. Vui lòng thêm tài khoản trước.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Message */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Nội dung bài đăng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                id="api-message"
                placeholder="Nhập nội dung bài viết của bạn..."
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="resize-none"
              />

              {/* Image picker */}
              <div className="flex flex-col gap-3">
                <Button
                  id="api-select-image"
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSelectImage}
                  disabled={runState.status === "running"}
                  className="w-max"
                >
                  <ImageIcon size={14} className="mr-2" /> Chọn ảnh
                </Button>
                {imagePaths.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {imagePaths.map((p, i) => (
                      <div
                        key={i}
                        className="bg-secondary flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-xs"
                      >
                        <span className="text-muted-foreground truncate">📎 {p.split(/[\\/]/).pop()}</span>
                        <button
                          onClick={() => handleRemoveImage(i)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Groups */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Danh sách Groups
                {groupUrls.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {groupUrls.length} groups
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                id="api-groups"
                placeholder={`https://www.facebook.com/groups/123456789\nhttps://www.facebook.com/groups/987654321`}
                rows={8}
                value={groupsText}
                onChange={(e) => setGroupsText(e.target.value)}
                className="resize-none font-mono text-xs"
              />
              <p className="text-muted-foreground mt-2 text-xs">Mỗi group URL mỗi dòng</p>
            </CardContent>
          </Card>

          {/* Advanced settings */}
          <Card>
            <CardContent className="p-0">
              <button
                className="hover:bg-accent/40 flex w-full items-center justify-between p-4 text-sm font-medium transition-colors"
                onClick={() => setShowAdvanced((v) => !v)}
                id="api-toggle-advanced"
              >
                <span className="flex items-center gap-2">
                  <Zap size={14} className="text-primary" />
                  Cài đặt nâng cao
                </span>
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-border space-y-4 border-t p-4">
                      <p className="text-muted-foreground text-xs">
                        Delay ngẫu nhiên giữa các lần đăng ({delayMin}–{delayMax} giây)
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="api-delay-min" className="text-xs">
                            Delay tối thiểu (giây)
                          </Label>
                          <Input
                            id="api-delay-min"
                            type="number"
                            min={1}
                            max={delayMax}
                            value={delayMin}
                            onChange={(e) => setDelayMin(Math.max(1, Number(e.target.value)))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="api-delay-max" className="text-xs">
                            Delay tối đa (giây)
                          </Label>
                          <Input
                            id="api-delay-max"
                            type="number"
                            min={delayMin}
                            max={300}
                            value={delayMax}
                            onChange={(e) => setDelayMax(Math.max(delayMin, Number(e.target.value)))}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Run button */}
          <Button id="api-run-btn" className="w-full" size="lg" disabled={!canRun} onClick={handleRun}>
            {runState.status === "running" ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Đang đăng bài... ({runState.results.length}/{groupUrls.length})
              </>
            ) : (
              <>
                <Play size={18} /> Bắt đầu đăng bài
              </>
            )}
          </Button>
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
                  <p>✅ Delay 5–10 giây giữa các bài</p>
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
