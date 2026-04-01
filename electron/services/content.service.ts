import { v4 as uuidv4 } from "uuid";
import { store } from "./store.js";

export interface Content {
  id: string;
  title: string;
  body: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export class ContentService {
  getAll(): Content[] {
    return store.get("contents") as Content[];
  }

  getById(id: string): Content | undefined {
    return this.getAll().find((c) => c.id === id);
  }

  add(data: Omit<Content, "id" | "createdAt" | "updatedAt">): Content {
    const contents = this.getAll();
    const now = new Date().toISOString();
    const content: Content = {
      ...data,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };
    contents.push(content);
    store.set("contents", contents);
    return content;
  }

  update(id: string, updates: Partial<Content>): Content {
    const contents = this.getAll();
    const index = contents.findIndex((c) => c.id === id);
    if (index === -1) throw new Error("Content not found");

    contents[index] = {
      ...contents[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    store.set("contents", contents);
    return contents[index];
  }

  delete(id: string): void {
    const contents = this.getAll().filter((c) => c.id !== id);
    store.set("contents", contents);
  }
}

export const contentService = new ContentService();
