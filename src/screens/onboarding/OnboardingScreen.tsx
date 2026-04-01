import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, ChevronRight, Shield, Zap } from "lucide-react";

interface OnboardingScreenProps {
  onAccept: () => void;
}

export default function OnboardingScreen({ onAccept }: OnboardingScreenProps) {
  return (
    <div className="bg-background app-drag fixed inset-0 z-9999 flex items-center justify-center p-6">
      <div className="animate-in fade-in slide-in-from-bottom-4 w-full max-w-170 duration-500">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex size-18 items-center justify-center rounded-2xl bg-linear-to-br from-[#6c5ce7] via-[#a855f7] to-[#ec4899] text-white shadow-[0_8px_32px_rgba(108,92,231,0.3)]">
            <Zap size={36} />
          </div>
          <h1 className="gradient-text mb-2 text-[32px] font-extrabold tracking-tight">Auto Facebook Desktop</h1>
          <p className="text-muted-foreground text-[15px]">Công cụ tự động hóa marketing Facebook</p>
        </div>

        {/* Features */}
        <Card className="mb-8">
          <CardContent className="space-y-4 p-6">
            {[
              {
                icon: Shield,
                color: "#3b82f6",
                title: "Stealth Mode",
                desc: "Sử dụng puppeteer-stealth để tránh bị phát hiện"
              },
              {
                icon: Zap,
                color: "#22c55e",
                title: "Đa luồng",
                desc: "Chạy nhiều chiến dịch đồng thời, tiết kiệm thời gian"
              },
              {
                icon: CheckCircle,
                color: "#f59e0b",
                title: "Lên lịch tự động",
                desc: "Đặt lịch chiến dịch, tool tự chạy đúng giờ"
              }
            ].map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={i} className="flex items-start gap-4">
                  <div
                    className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ color: feature.color }}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{feature.title}</div>
                    <div className="text-muted-foreground text-[13px]">{feature.desc}</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <div className="border-warning/20 bg-warning/5 mb-7 rounded-2xl border p-5">
          <div className="text-warning mb-3 flex items-center gap-2 text-sm font-bold">
            <AlertTriangle size={18} />
            <strong>Tuyên bố miễn trừ trách nhiệm</strong>
          </div>
          <div className="text-muted-foreground space-y-2.5 text-[13px] leading-relaxed">
            <p>
              Công cụ này tự động hóa hành vi trên Facebook, điều này{" "}
              <strong>vi phạm Điều khoản Dịch vụ (ToS) của Meta/Facebook</strong>. Bằng cách tiếp tục, bạn xác nhận
              rằng:
            </p>
            <ul className="space-y-1.5">
              {[
                "Bạn đã đọc và hiểu rủi ro về việc vi phạm Facebook ToS",
                "Tài khoản Facebook của bạn có thể bị hạn chế hoặc vô hiệu hóa",
                "Nhà phát triển không chịu trách nhiệm về mọi hậu quả phát sinh",
                "Bạn sử dụng công cụ hoàn toàn theo quyết định và rủi ro của cá nhân",
                "Không sử dụng để spam, quấy rối, hoặc vi phạm pháp luật"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-warning">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button size="lg" className="px-8 text-base" onClick={onAccept}>
            Tôi hiểu và đồng ý
            <ChevronRight size={18} />
          </Button>
          <p className="text-muted-foreground mt-3 text-xs">
            Nhấn "Tôi hiểu và đồng ý" có nghĩa là bạn chấp nhận toàn bộ điều khoản trên.
          </p>
        </div>
      </div>
    </div>
  );
}
