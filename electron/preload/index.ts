import { contextBridge, ipcRenderer } from "electron";

console.log("[Preload] Script loading...");

// Types
export interface Account {
  id: string;
  email: string;
  password: string;
  name?: string;
  status: "active" | "inactive" | "error";
  lastLogin?: string;
  cookiesPath?: string;
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

export interface LicenseLimits {
  maxAccounts: number;
  maxGroups: number;
  maxConcurrent: number;
}

// API exposed to renderer
const api = {
  // Account operations
  getAccounts: (): Promise<Account[]> => ipcRenderer.invoke("accounts:getAll"),
  addAccount: (account: Omit<Account, "id" | "createdAt" | "status">): Promise<Account> =>
    ipcRenderer.invoke("accounts:add", account),
  updateAccount: (id: string, updates: Partial<Account>): Promise<Account> =>
    ipcRenderer.invoke("accounts:update", id, updates),
  deleteAccount: (id: string): Promise<void> => ipcRenderer.invoke("accounts:delete", id),
  checkAccount: (id: string): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke("accounts:check", id),

  // Content operations
  getContents: (): Promise<Content[]> => ipcRenderer.invoke("contents:getAll"),
  addContent: (content: Omit<Content, "id" | "createdAt" | "updatedAt">): Promise<Content> =>
    ipcRenderer.invoke("contents:add", content),
  updateContent: (id: string, updates: Partial<Content>): Promise<Content> =>
    ipcRenderer.invoke("contents:update", id, updates),
  deleteContent: (id: string): Promise<void> => ipcRenderer.invoke("contents:delete", id),

  // Campaign operations
  getCampaigns: (): Promise<Campaign[]> => ipcRenderer.invoke("campaigns:getAll"),
  addCampaign: (campaign: Omit<Campaign, "id" | "createdAt" | "status">): Promise<Campaign> =>
    ipcRenderer.invoke("campaigns:add", campaign),
  updateCampaign: (id: string, updates: Partial<Campaign>): Promise<Campaign> =>
    ipcRenderer.invoke("campaigns:update", id, updates),
  deleteCampaign: (id: string): Promise<void> => ipcRenderer.invoke("campaigns:delete", id),
  runCampaign: (id: string): Promise<void> => ipcRenderer.invoke("campaigns:run", id),
  stopCampaign: (id: string): Promise<void> => ipcRenderer.invoke("campaigns:stop", id),

  // Scheduler
  scheduleCampaign: (id: string, datetime: string): Promise<void> =>
    ipcRenderer.invoke("scheduler:schedule", id, datetime),
  cancelSchedule: (id: string): Promise<void> => ipcRenderer.invoke("scheduler:cancel", id),
  getScheduledCampaigns: (): Promise<Campaign[]> => ipcRenderer.invoke("scheduler:getAll"),

  // File dialog
  selectImages: (): Promise<string[]> => ipcRenderer.invoke("dialog:selectImages"),

  // Logs
  onLog: (callback: (log: LogEntry) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, log: LogEntry) => callback(log);
    ipcRenderer.on("log:entry", handler);
    return () => ipcRenderer.removeListener("log:entry", handler);
  },

  onCampaignUpdate: (callback: (campaign: Campaign) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, campaign: Campaign) => callback(campaign);
    ipcRenderer.on("campaign:update", handler);
    return () => ipcRenderer.removeListener("campaign:update", handler);
  },

  // Stats
  getStats: (): Promise<{
    totalAccounts: number;
    totalContents: number;
    totalCampaigns: number;
    scheduledCount: number;
    successRate: number;
  }> => ipcRenderer.invoke("stats:get"),

  // Posts operations
  getPosts: (): Promise<Post[]> => ipcRenderer.invoke("posts:getAll"),
  deletePost: (id: string): Promise<void> => ipcRenderer.invoke("posts:delete", id),
  getPostsByCampaign: (campaignId: string): Promise<Post[]> => ipcRenderer.invoke("posts:getByCampaign", campaignId),

  // Comment Campaign operations
  getCommentCampaigns: (): Promise<CommentCampaign[]> => ipcRenderer.invoke("commentCampaigns:getAll"),
  addCommentCampaign: (campaign: Omit<CommentCampaign, "id" | "createdAt" | "status">): Promise<CommentCampaign> =>
    ipcRenderer.invoke("commentCampaigns:add", campaign),
  updateCommentCampaign: (id: string, updates: Partial<CommentCampaign>): Promise<CommentCampaign> =>
    ipcRenderer.invoke("commentCampaigns:update", id, updates),
  deleteCommentCampaign: (id: string): Promise<void> => ipcRenderer.invoke("commentCampaigns:delete", id),
  runCommentCampaign: (id: string): Promise<void> => ipcRenderer.invoke("commentCampaigns:run", id),
  stopCommentCampaign: (id: string): Promise<void> => ipcRenderer.invoke("commentCampaigns:stop", id),

  // License operations
  getLicenseInfo: (): Promise<LicenseInfo | null> => ipcRenderer.invoke("license:getInfo"),
  activateLicense: (key: string): Promise<{ success: boolean; data?: LicenseInfo; error?: string }> =>
    ipcRenderer.invoke("license:activate", key),
  deactivateLicense: (): Promise<{ success: boolean }> => ipcRenderer.invoke("license:deactivate"),
  getLicenseLimits: (): Promise<LicenseLimits> => ipcRenderer.invoke("license:getLimits"),

  // App info
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion"),
  checkForUpdates: (): Promise<{ success: boolean; updateInfo?: any; error?: string }> =>
    ipcRenderer.invoke("app:checkForUpdates")
};

try {
  contextBridge.exposeInMainWorld("api", api);
  console.log("[Preload] API exposed successfully. Keys:", Object.keys(api));
} catch (err) {
  console.error("[Preload] Failed to expose API:", err);
}

export type ElectronAPI = typeof api;
