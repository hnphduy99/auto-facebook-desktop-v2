import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  CalendarDays,
  FileText,
  Globe,
  Key,
  LayoutDashboard,
  Link as LinkIcon,
  MessageCircle,
  Rocket,
  ScrollText,
  SquareFunction,
  Users,
  Zap
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ModeToggle } from "@/components/ModeToggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";
import { useAppStore } from "@/store";

const navItems = [
  { id: "dashboard", icon: LayoutDashboard, key: "dashboard" as const },
  { id: "accounts", icon: Users, key: "accounts" as const },
  { id: "contents", icon: FileText, key: "contents" as const },
  { id: "campaigns", icon: Rocket, key: "campaigns" as const },
  { id: "posts", icon: LinkIcon, key: "posts" as const },
  { id: "commentCampaigns", icon: MessageCircle, key: "commentCampaigns" as const },
  { id: "schedule", icon: CalendarDays, key: "schedule" as const },
  { id: "api-facebook", icon: Zap, key: "apiFacebook" as const },
  { id: "logs", icon: ScrollText, key: "logs" as const }
];

const TIER_COLORS: Record<string, string> = {
  trial: "#f59e0b",
  basic: "#3b82f6",
  pro: "#8b5cf6"
};
const TIER_LABELS: Record<string, string> = {
  trial: "Trial",
  basic: "Basic",
  pro: "Pro"
};

export function AppSidebar() {
  const { language, setLanguage, t, license } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();

  const toggleLanguage = () => {
    setLanguage(language === "vi" ? "en" : "vi");
  };

  return (
    <Sidebar className="border-border app-drag border-r">
      <SidebarHeader className="border-border border-b p-5 pt-12">
        <div className="flex items-center gap-3">
          <div className="flex size-10.5 items-center justify-center rounded-xl bg-linear-to-br from-[#6c5ce7] via-[#a855f7] to-[#ec4899] shadow-[0_4px_16px_rgba(108,92,231,0.3)]">
            <SquareFunction className="text-white" size={20} />
          </div>
          <div>
            <div className="gradient-text text-lg font-bold tracking-tight">AutoPost</div>
            <div className="text-muted-foreground text-[11px] font-normal tracking-wider uppercase">
              Facebook Groups
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === `/${item.id}`;
                return (
                  <SidebarMenuItem key={item.id} className="relative cursor-pointer py-1">
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active-bg"
                        className="absolute inset-x-0 inset-y-1 z-0 rounded-md border border-[rgb(108_92_231/0.2)] bg-[rgb(108_92_231/0.12)]"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => navigate(`/${item.id}`)}
                      className="relative z-10 h-10 cursor-pointer gap-3 text-sm font-medium transition-colors"
                      style={isActive ? { backgroundColor: "transparent" } : undefined}
                    >
                      <Icon className={isActive ? "text-primary" : ""} size={20} />
                      <span className={isActive ? "text-primary" : ""}>{t.nav[item.key]}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* License item (hidden) */}
              <SidebarMenuItem className="hidden">
                <SidebarMenuButton
                  isActive={location.pathname === "/license"}
                  onClick={() => navigate("/license")}
                  className="h-10 gap-3 text-sm font-medium"
                >
                  <Key size={20} />
                  <span className="flex-1">License</span>
                  {license && license.isValid ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{
                        background: `${TIER_COLORS[license.tier]}22`,
                        color: TIER_COLORS[license.tier],
                        border: `1px solid ${TIER_COLORS[license.tier]}44`
                      }}
                    >
                      {TIER_LABELS[license.tier]}
                    </span>
                  ) : (
                    <span className="bg-destructive/15 text-destructive rounded-full px-2 py-0.5 text-[10px] font-bold">
                      Chưa kích hoạt
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-border flex flex-row justify-between border-t p-3">
        <Button
          variant="outline"
          onClick={toggleLanguage}
          className="border-border bg-secondary hover:bg-accent hover:border-primary min-w-50 justify-start gap-2 rounded-xl px-3 py-2 transition-colors"
        >
          <Globe size={16} className="text-muted-foreground" />
          <span className="text-muted-foreground flex-1 text-left text-xs">{t.common.language}</span>
          <span className="text-primary text-[13px] font-semibold">{language === "vi" ? "🇻🇳 VN" : "🇺🇸 EN"}</span>
        </Button>
        <ModeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
