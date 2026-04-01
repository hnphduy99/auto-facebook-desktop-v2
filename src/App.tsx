import { AppSidebar } from "@/components/layout/AppSidebar";
import PageLoader from "@/components/layout/PageLoader";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAppStore } from "@/store";
import { AnimatePresence } from "framer-motion";
import { lazy, Suspense, useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { toast } from "sonner";

const DashboardScreen = lazy(() => import("@/screens/dashboard/DashboardScreen"));
const AccountsScreen = lazy(() => import("@/screens/accounts/AccountsScreen"));
const ContentsScreen = lazy(() => import("@/screens/contents/ContentsScreen"));
const CampaignsScreen = lazy(() => import("@/screens/campaigns/CampaignsScreen"));
const PostsScreen = lazy(() => import("@/screens/posts/PostsScreen"));
const CommentCampaignsScreen = lazy(() => import("@/screens/comment-campaigns/CommentCampaignsScreen"));
const ScheduleScreen = lazy(() => import("@/screens/schedule/ScheduleScreen"));
const LogsScreen = lazy(() => import("@/screens/logs/LogsScreen"));
const LicenseScreen = lazy(() => import("@/screens/license/LicenseScreen"));
const OnboardingScreen = lazy(() => import("@/screens/onboarding/OnboardingScreen"));

const DISCLAIMER_ACCEPTED_KEY = "disclaimer_accepted_v1";

function AppShell() {
  const { addLog, updateCampaign, setLicense } = useAppStore();
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean>(
    () => localStorage.getItem(DISCLAIMER_ACCEPTED_KEY) === "true"
  );
  const location = useLocation();

  useEffect(() => {
    if (!window.api) {
      toast.warning(
        "Electron API không khả dụng. Vui lòng chạy ứng dụng qua Electron (npm run dev) để sử dụng đầy đủ tính năng."
      );
      return;
    }

    const unsubLog = window.api.onLog((log) => {
      addLog(log);
    });

    const unsubCampaign = window.api.onCampaignUpdate((campaign) => {
      updateCampaign(campaign);
    });

    window.api.getLicenseInfo().then((info) => {
      setLicense(info);
    });

    return () => {
      unsubLog();
      unsubCampaign();
    };
  }, [addLog, updateCampaign, setLicense]);

  const handleAcceptDisclaimer = () => {
    localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "true");
    setDisclaimerAccepted(true);
  };

  if (!disclaimerAccepted) {
    return (
      <Suspense fallback={<PageLoader />}>
        <OnboardingScreen onAccept={handleAcceptDisclaimer} />
        <Toaster position="top-right" richColors />
      </Suspense>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <main className="bg-sidebar flex-1 overflow-y-auto p-8 pt-12">
          <Suspense fallback={<PageLoader />}>
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardScreen />} />
                <Route path="/accounts" element={<AccountsScreen />} />
                <Route path="/contents" element={<ContentsScreen />} />
                <Route path="/campaigns" element={<CampaignsScreen />} />
                <Route path="/posts" element={<PostsScreen />} />
                <Route path="/commentCampaigns" element={<CommentCampaignsScreen />} />
                <Route path="/schedule" element={<ScheduleScreen />} />
                <Route path="/logs" element={<LogsScreen />} />
                <Route path="/license" element={<LicenseScreen />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </SidebarProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <HashRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <AppShell />
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
