import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store";
import { CheckCircle, Key, Loader2, LogOut, RefreshCw, Shield, Star, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface LicenseInfo {
  key: string; tier: "trial" | "basic" | "pro"; expiresAt: string | null;
  activatedAt: string; machineId: string; isValid: boolean; daysLeft: number | null;
}

const TIER_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  trial: { label: "Dùng thử", color: "#f59e0b", icon: <Zap size={16} /> },
  basic: { label: "Basic", color: "#3b82f6", icon: <Shield size={16} /> },
  pro: { label: "Pro", color: "#8b5cf6", icon: <Star size={16} /> }
};

export default function LicenseScreen() {
  const { license, setLicense } = useAppStore();
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [appVersion, setAppVersion] = useState("");

  const loadLicenseInfo = useCallback(async () => {
    if (!window.api) return;
    try { const info = await window.api.getLicenseInfo(); setLicense(info); } catch (err) { console.error(err); }
  }, [setLicense]);

  const loadAppVersion = async () => {
    if (!window.api) return;
    try { const v = await window.api.getAppVersion(); setAppVersion(v); } catch { setAppVersion("--"); }
  };

  useEffect(() => { loadLicenseInfo(); loadAppVersion(); }, [loadLicenseInfo]);

  const handleActivate = async () => {
    if (!window.api || !keyInput.trim()) { toast.error("Vui lòng nhập license key."); return; }
    setLoading(true);
    try {
      const result = await window.api.activateLicense(keyInput.trim());
      if (result.success && result.data) { setLicense(result.data as LicenseInfo); toast.success("Kích hoạt license thành công! 🎉"); setKeyInput(""); }
      else { toast.error(result.error || "Kích hoạt thất bại."); }
    } catch (err: any) { toast.error(err?.message || "Có lỗi xảy ra."); }
    finally { setLoading(false); }
  };

  const handleDeactivate = async () => {
    if (!window.api || !confirm("Bạn có chắc chắn muốn hủy kích hoạt license không?")) return;
    await window.api.deactivateLicense(); setLicense(null); toast.info("Đã hủy kích hoạt license.");
  };

  const handleCheckUpdate = async () => {
    if (!window.api) return;
    setChecking(true);
    try {
      const result = await window.api.checkForUpdates();
      if (result.success && result.updateInfo) toast.success(`Có phiên bản mới: v${result.updateInfo.version}!`);
      else if (result.success) toast.info("Bạn đang dùng phiên bản mới nhất! ✅");
      else toast.warning(result.error || "Không kiểm tra được cập nhật.");
    } catch { toast.warning("Không thể kiểm tra cập nhật."); }
    finally { setChecking(false); }
  };

  const tierInfo = license ? TIER_LABELS[license.tier] : null;

  return (
    <div>
      <div className="mb-8"><h1 className="gradient-text text-[28px] font-extrabold tracking-tight">License & Cập nhật</h1></div>
      <div className="space-y-6">
        {/* License Status */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-2.5"><Key size={20} className="text-primary" /><h2 className="text-base font-bold">Trạng thái License</h2></div>
            {license && license.isValid ? (
              <div>
                <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-bold" style={{ background: `${tierInfo?.color}22`, color: tierInfo?.color, borderColor: `${tierInfo?.color}44` }}>
                  {tierInfo?.icon}<span>{tierInfo?.label}</span>
                </div>
                <div className="space-y-0">
                  {[{ label: "Tier", value: tierInfo?.label, color: tierInfo?.color, bold: true },
                    { label: "Kích hoạt lúc", value: new Date(license.activatedAt).toLocaleDateString("vi-VN") },
                    { label: "Hết hạn", value: license.expiresAt ? `${new Date(license.expiresAt).toLocaleDateString("vi-VN")}${license.daysLeft !== null ? ` (còn ${license.daysLeft} ngày)` : ""}` : "Vĩnh viễn ♾️" },
                    { label: "Key", value: license.key.slice(0, 24) + "...", mono: true }
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
                      <span className="text-[13px] font-medium text-muted-foreground">{row.label}</span>
                      <span className={`text-[13px] font-semibold ${row.mono ? "font-mono text-xs text-muted-foreground" : ""}`} style={row.bold ? { color: row.color, fontWeight: 700 } : undefined}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="destructive" className="mt-4" onClick={handleDeactivate}><LogOut size={14} />Hủy kích hoạt</Button>
              </div>
            ) : (
              <div className="text-center py-5">
                <div className="text-5xl mb-3 opacity-50 grayscale">🔒</div>
                <p className="font-semibold text-base text-muted-foreground mb-1">Chưa có license hợp lệ</p>
                <p className="text-sm text-muted-foreground">Nhập license key bên dưới để kích hoạt</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Limits */}
        {license && license.isValid && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-5 flex items-center gap-2.5"><Shield size={20} className="text-primary" /><h2 className="text-base font-bold">Giới hạn gói</h2></div>
              <LimitDisplay tier={license.tier} />
            </CardContent>
          </Card>
        )}

        {/* Activate Form */}
        {(!license || !license.isValid) && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-5 flex items-center gap-2.5"><CheckCircle size={20} className="text-primary" /><h2 className="text-base font-bold">Kích hoạt License</h2></div>
              <div className="mt-4 space-y-2">
                <Label>License Key</Label>
                <Input value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Nhập license key của bạn..." onKeyDown={(e) => e.key === "Enter" && handleActivate()} />
                <p className="text-sm text-muted-foreground">💡 Liên hệ để mua license key và nhận hỗ trợ kích hoạt.</p>
              </div>
              <Button className="mt-4" onClick={handleActivate} disabled={loading || !keyInput.trim()}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
                {loading ? "Đang kích hoạt..." : "Kích hoạt"}
              </Button>
              <Separator className="my-6" />
              <div className="grid grid-cols-3 gap-4">
                <PricingCard tier="Trial" price="Miễn phí" duration="7 ngày" color="#f59e0b" features={["1 tài khoản Facebook", "5 nhóm/chiến dịch", "1 luồng đồng thời"]} />
                <PricingCard tier="Basic" price="299.000đ" duration="/tháng" color="#3b82f6" features={["3 tài khoản Facebook", "50 nhóm/chiến dịch", "2 luồng đồng thời", "Hỗ trợ cơ bản"]} />
                <PricingCard tier="Pro" price="699.000đ" duration="/tháng" color="#8b5cf6" features={["10 tài khoản Facebook", "Không giới hạn nhóm", "5 luồng đồng thời", "Ưu tiên hỗ trợ"]} highlighted />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Version & Update */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-2.5"><RefreshCw size={20} className="text-primary" /><h2 className="text-base font-bold">Phiên bản & Cập nhật</h2></div>
            <div className="flex items-center justify-between border-b border-border py-2.5">
              <span className="text-[13px] text-muted-foreground">Phiên bản hiện tại</span>
              <span className="rounded-full bg-secondary px-3 py-1 font-mono text-xs font-semibold text-[#00cec9]">v{appVersion || "--"}</span>
            </div>
            <Button variant="secondary" className="mt-4" onClick={handleCheckUpdate} disabled={checking}>
              {checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {checking ? "Đang kiểm tra..." : "Kiểm tra cập nhật"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LimitDisplay({ tier }: { tier: string }) {
  const limits: Record<string, { maxAccounts: number; maxGroups: number; maxConcurrent: number }> = {
    trial: { maxAccounts: 1, maxGroups: 5, maxConcurrent: 1 },
    basic: { maxAccounts: 3, maxGroups: 50, maxConcurrent: 2 },
    pro: { maxAccounts: 10, maxGroups: 999, maxConcurrent: 5 }
  };
  const l = limits[tier] || limits.trial;
  return (
    <div>
      {[{ label: "Tài khoản Facebook", value: l.maxAccounts },
        { label: "Nhóm tối đa/chiến dịch", value: l.maxGroups === 999 ? "Không giới hạn" : l.maxGroups },
        { label: "Luồng đồng thời", value: l.maxConcurrent }
      ].map((item, i) => (
        <div key={i} className="flex items-center justify-between border-b border-border py-3 last:border-b-0">
          <span className="text-[13px] text-muted-foreground">{item.label}</span>
          <span className="text-sm font-bold text-primary">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function PricingCard({ tier, price, duration, color, features, highlighted = false }: {
  tier: string; price: string; duration: string; color: string; features: string[]; highlighted?: boolean;
}) {
  return (
    <div className={`relative rounded-2xl border p-5 transition-all hover:-translate-y-0.5 ${highlighted ? "bg-accent" : "bg-secondary"}`} style={{ borderColor: highlighted ? color : undefined }}>
      {highlighted && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white" style={{ background: color }}>Phổ biến</div>}
      <div className="mb-2 text-base font-extrabold" style={{ color }}>{tier}</div>
      <div className="mb-4 text-xl font-extrabold">{price}<span className="ml-1 text-[13px] font-normal text-muted-foreground">{duration}</span></div>
      <ul className="space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle size={13} style={{ color }} />{f}</li>
        ))}
      </ul>
    </div>
  );
}
