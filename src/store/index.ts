import { getTranslations, Language, Translations } from "@/i18n";
import { create } from "zustand";

export interface Account {
  id: string;
  email: string;
  password: string;
  name?: string;
  status: "active" | "inactive" | "error";
  lastLogin?: string;
  createdAt: string;
}

export interface Content {
  id: string;
  title: string;
  body: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  accountId: string;
  contentId: string;
  groups: string[];
  maxConcurrent: number;
  status: "draft" | "running" | "completed" | "failed" | "scheduled" | "stopped";
  scheduledAt?: string;
  completedAt?: string;
  results?: { groupUrl: string; success: boolean; error?: string; postUrl?: string }[];
  createdAt: string;
}

export interface Post {
  id: string;
  postUrl: string;
  groupUrl: string;
  groupName?: string;
  campaignId: string;
  campaignName: string;
  accountId: string;
  contentSnippet: string;
  postedAt: string;
  createdAt: string;
}

export interface CommentItem {
  text: string;
  images: string[];
}

export interface CommentCampaignResult {
  postId: string;
  postUrl: string;
  comments: {
    index: number;
    success: boolean;
    error?: string;
  }[];
}

export interface CommentCampaign {
  id: string;
  name: string;
  accountId: string;
  comments: CommentItem[];
  postIds: string[];
  delayBetweenComments: number;
  delayBetweenPosts: number;
  status: "draft" | "running" | "completed" | "failed" | "stopped";
  results?: CommentCampaignResult[];
  completedAt?: string;
  createdAt: string;
}

export interface LogEntry {
  timestamp: string;
  level: "info" | "success" | "error" | "warning";
  message: string;
  campaignId?: string;
}

export interface Stats {
  totalAccounts: number;
  totalContents: number;
  totalCampaigns: number;
  scheduledCount: number;
  successRate: number;
}

export type LicenseTier = "trial" | "basic" | "pro";

export interface LicenseInfo {
  key: string;
  tier: LicenseTier;
  expiresAt: string | null;
  activatedAt: string;
  machineId: string;
  isValid: boolean;
  daysLeft: number | null;
}

export interface AccountItem {
  label: string;
  value: string;
}

interface AppState {
  language: Language;
  t: Translations;
  setLanguage: (lang: Language) => void;

  accounts: Account[];
  accountItems: AccountItem[];
  contents: Content[];
  campaigns: Campaign[];
  posts: Post[];
  commentCampaigns: CommentCampaign[];
  logs: LogEntry[];
  stats: Stats;

  license: LicenseInfo | null;
  setLicense: (info: LicenseInfo | null) => void;

  setAccounts: (accounts: Account[]) => void;
  setContents: (contents: Content[]) => void;
  setCampaigns: (campaigns: Campaign[]) => void;
  setPosts: (posts: Post[]) => void;
  setCommentCampaigns: (campaigns: CommentCampaign[]) => void;
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  setStats: (stats: Stats) => void;
  updateCampaign: (campaign: Campaign) => void;

  currentPage: string;
  setCurrentPage: (page: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  language: "vi",
  t: getTranslations("vi"),
  setLanguage: (lang) =>
    set({
      language: lang,
      t: getTranslations(lang)
    }),

  accounts: [],
  accountItems: [],
  contents: [],
  campaigns: [],
  posts: [],
  commentCampaigns: [],
  logs: [],
  stats: {
    totalAccounts: 0,
    totalContents: 0,
    totalCampaigns: 0,
    scheduledCount: 0,
    successRate: 0
  },

  license: null,
  setLicense: (info) => set({ license: info }),

  setAccounts: (accounts) =>
    set({
      accounts,
      accountItems: accounts.map((acc) => ({
        label: acc.name || acc.email,
        value: acc.id
      }))
    }),
  setContents: (contents) => set({ contents }),
  setCampaigns: (campaigns) => set({ campaigns }),
  setPosts: (posts) => set({ posts }),
  setCommentCampaigns: (commentCampaigns) => set({ commentCampaigns }),
  addLog: (log) =>
    set((state) => ({
      logs: [log, ...state.logs].slice(0, 500)
    })),
  clearLogs: () => set({ logs: [] }),
  setStats: (stats) => set({ stats }),
  updateCampaign: (campaign) =>
    set((state) => ({
      campaigns: state.campaigns.map((c) => (c.id === campaign.id ? campaign : c))
    })),

  currentPage: "dashboard",
  setCurrentPage: (page) => set({ currentPage: page })
}));
