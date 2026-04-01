import type { ElectronAPI } from "./index";

declare global {
  interface Window {
    electron: import("@electron-toolkit/preload").ElectronAPI;
    api: ElectronAPI;
  }
}
