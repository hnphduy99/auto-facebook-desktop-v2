import { v4 as uuidv4 } from "uuid";
import { store } from "./store.js";

export interface CommentItem {
  text: string; // Nội dung comment
  images: string[]; // Ảnh đính kèm (có thể rỗng)
}

export interface CommentCampaignResult {
  postId: string; // ID bài đăng
  postUrl: string; // URL bài đăng
  comments: {
    index: number; // Thứ tự comment
    success: boolean;
    error?: string;
  }[];
}

export interface CommentCampaign {
  id: string;
  name: string; // Tên chiến dịch comment
  accountId: string; // Tài khoản dùng để comment
  comments: CommentItem[]; // Danh sách comment (1 hoặc nhiều)
  postIds: string[]; // Danh sách ID bài đăng được chọn
  delayBetweenComments: number; // Delay giữa các comment (ms)
  delayBetweenPosts: number; // Delay giữa các bài (ms)
  status: "draft" | "running" | "completed" | "failed" | "stopped";
  results?: CommentCampaignResult[];
  completedAt?: string;
  createdAt: string;
}

export class CommentCampaignService {
  getAll(): CommentCampaign[] {
    return (store.get("commentCampaigns") as CommentCampaign[]) || [];
  }

  getById(id: string): CommentCampaign | undefined {
    return this.getAll().find((c) => c.id === id);
  }

  add(
    data: Omit<CommentCampaign, "id" | "createdAt" | "status"> & {
      status?: CommentCampaign["status"];
    }
  ): CommentCampaign {
    const campaigns = this.getAll();
    const campaign: CommentCampaign = {
      ...data,
      id: uuidv4(),
      status: data.status || "draft",
      createdAt: new Date().toISOString()
    };
    campaigns.unshift(campaign);
    store.set("commentCampaigns", campaigns);
    return campaign;
  }

  update(id: string, updates: Partial<CommentCampaign>): CommentCampaign {
    const campaigns = this.getAll();
    const index = campaigns.findIndex((c) => c.id === id);
    if (index === -1) throw new Error("Comment campaign not found");

    campaigns[index] = { ...campaigns[index], ...updates };
    store.set("commentCampaigns", campaigns);
    return campaigns[index];
  }

  delete(id: string): void {
    const campaigns = this.getAll().filter((c) => c.id !== id);
    store.set("commentCampaigns", campaigns);
  }
}

export const commentCampaignService = new CommentCampaignService();
