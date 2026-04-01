import { app } from "electron";
import fs from "fs";
import path from "path";

interface StoreData {
  accounts: any[];
  contents: any[];
  campaigns: any[];
  posts: any[];
  commentCampaigns: any[];
  settings: Record<string, any>;
  license: Record<string, any> | null;
}

const DEFAULT_DATA: StoreData = {
  accounts: [],
  contents: [],
  campaigns: [],
  posts: [],
  commentCampaigns: [],
  settings: { language: "vi", theme: "dark" },
  license: null
};

class Store {
  private data: StoreData | null = null;
  private _filePath: string | null = null;

  /**
   * Lazy getter: ensures app.getPath('userData') is ONLY called after app.whenReady()
   */
  private get filePath(): string {
    if (!this._filePath) {
      const userDataPath = app.getPath("userData");
      this._filePath = path.join(userDataPath, "app-data.json");

      // Ensure sessions directory exists
      const sessionsDir = path.join(userDataPath, "sessions");
      if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
      }
    }
    return this._filePath;
  }

  private ensureLoaded(): StoreData {
    if (!this.data) {
      this.data = this.load();
    }
    return this.data;
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        return { ...DEFAULT_DATA, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.error("Failed to load store:", err);
    }
    return { ...DEFAULT_DATA };
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.ensureLoaded(), null, 2));
    } catch (err) {
      console.error("Failed to save store:", err);
    }
  }

  get<K extends keyof StoreData>(key: K): StoreData[K] {
    return this.ensureLoaded()[key];
  }

  set<K extends keyof StoreData>(key: K, value: StoreData[K]): void {
    const data = this.ensureLoaded();
    data[key] = value;
    this.save();
  }

  getSessionsDir(): string {
    return path.join(app.getPath("userData"), "sessions");
  }

  getUploadsDir(): string {
    const dir = path.join(app.getPath("userData"), "uploads");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  getCookiesPath(email: string): string {
    const sanitized = email.replace(/[^a-zA-Z0-9]/g, "_");
    const dir = path.join(this.getSessionsDir(), sanitized);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, "cookies.json");
  }

  getProfilePath(email: string): string {
    const sanitized = email.replace(/[^a-zA-Z0-9]/g, "_");
    const dir = path.join(this.getSessionsDir(), sanitized, "profile");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }
}

export const store = new Store();
