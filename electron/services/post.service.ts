import { v4 as uuidv4 } from "uuid";
import { store } from "./store.js";

export interface Post {
  id: string;
  postUrl: string; // Link bài đăng (permalink)
  groupUrl: string; // URL group
  groupName?: string; // Tên group (nếu lấy được)
  campaignId: string; // ID chiến dịch gốc đã đăng
  campaignName: string; // Tên chiến dịch gốc
  accountId: string; // Tài khoản đã đăng
  contentSnippet: string; // Đoạn nội dung ngắn (50 ký tự đầu)
  postedAt: string; // Thời gian đăng
  createdAt: string;
}

export class PostService {
  getAll(): Post[] {
    return (store.get("posts") as Post[]) || [];
  }

  getById(id: string): Post | undefined {
    return this.getAll().find((p) => p.id === id);
  }

  add(data: Omit<Post, "id" | "createdAt" | "postedAt">): Post {
    const posts = this.getAll();
    const post: Post = {
      ...data,
      id: uuidv4(),
      postedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    posts.unshift(post); // Insert at the beginning so newest is first
    store.set("posts", posts);
    return post;
  }

  delete(id: string): void {
    const posts = this.getAll().filter((p) => p.id !== id);
    store.set("posts", posts);
  }

  getByCampaignId(campaignId: string): Post[] {
    return this.getAll().filter((p) => p.campaignId === campaignId);
  }
}

export const postService = new PostService();
