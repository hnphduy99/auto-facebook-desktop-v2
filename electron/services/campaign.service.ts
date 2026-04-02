import { v4 as uuidv4 } from "uuid";
import { store } from "./store.js";

export interface CampaignResult {
  groupUrl: string;
  success: boolean;
  error?: string;
  postUrl?: string;
}

export interface Campaign {
  id: string;
  name: string;
  accountId: string;
  contentId: string;
  groups: string[];
  maxConcurrent: number;
  status: "draft" | "running" | "paused" | "completed" | "failed" | "scheduled" | "stopped";
  scheduledAt?: string;
  completedAt?: string;
  results?: CampaignResult[];
  createdAt: string;
}

export class CampaignService {
  getAll(): Campaign[] {
    return store.get("campaigns") as Campaign[];
  }

  getById(id: string): Campaign | undefined {
    return this.getAll().find((c) => c.id === id);
  }

  add(
    data: Omit<Campaign, "id" | "createdAt" | "status"> & {
      status?: Campaign["status"];
    }
  ): Campaign {
    const campaigns = this.getAll();
    const campaign: Campaign = {
      ...data,
      id: uuidv4(),
      status: data.status || "draft",
      createdAt: new Date().toISOString()
    };
    campaigns.push(campaign);
    store.set("campaigns", campaigns);
    return campaign;
  }

  update(id: string, updates: Partial<Campaign>): Campaign {
    const campaigns = this.getAll();
    const index = campaigns.findIndex((c) => c.id === id);
    if (index === -1) throw new Error("Campaign not found");

    campaigns[index] = { ...campaigns[index], ...updates };
    store.set("campaigns", campaigns);
    return campaigns[index];
  }

  delete(id: string): void {
    const campaigns = this.getAll().filter((c) => c.id !== id);
    store.set("campaigns", campaigns);
  }

  getScheduled(): Campaign[] {
    return this.getAll().filter((c) => c.status === "scheduled" && c.scheduledAt);
  }
}

export const campaignService = new CampaignService();
