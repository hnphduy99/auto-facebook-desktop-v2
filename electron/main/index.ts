// Suppress EPIPE errors from broken stdout/stderr pipes (electron-vite dev)
process.stdout?.on?.("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") return;
  throw err;
});
process.stderr?.on?.("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") return;
  throw err;
});

import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { app, BrowserWindow, dialog, net, protocol, shell } from "electron";
import { pathToFileURL } from "node:url";
import { join } from "path";
import { registerAllIPC } from "../ipc/index.js";
import { browserService } from "../services/browser.service.js";
import { campaignService } from "../services/campaign.service.js";
import { SchedulerService } from "../services/scheduler.service.js";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: "#0a0a12",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  // Stop all running campaigns before the window closes
  mainWindow.on("close", (event) => {
    const runningCampaigns = campaignService.getAll().filter((c) => c.status === "running");
    if (runningCampaigns.length === 0) return;

    event.preventDefault();
    console.log(`[Main] Stopping ${runningCampaigns.length} running campaign(s) before quit...`);

    Promise.all(
      runningCampaigns.map(async (c) => {
        campaignService.update(c.id, { status: "stopped" });
        await browserService.stopCampaign(c.id);
        console.log(`[Main] Campaign ${c.id} stopped.`);
      })
    ).finally(() => {
      mainWindow?.destroy();
    });
  });

  mainWindow.webContents.on("console-message", (event) => {
    console.log(`[Renderer Console] ${event.message}`);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer based on electron-vite cli
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  console.log("[Main] App ready. Registering IPC handlers...");

  // Set app user model id for windows
  electronApp.setAppUserModelId("com.autopost.facebook");

  // Default open or close DevTools by F12 in development
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Register local protocol for image previews
  protocol.handle("local", (request) => {
    let filePath = request.url.slice("local://".length);
    filePath = filePath.split("?")[0].split("#")[0];
    filePath = decodeURIComponent(filePath);
    return net.fetch(pathToFileURL(filePath).toString());
  });

  // Register all IPC handlers
  registerAllIPC();
  console.log("[Main] IPC handlers registered.");

  // Start scheduler
  SchedulerService.getInstance().start();
  console.log("[Main] Scheduler started.");

  // Check Chrome trước khi mở cửa sổ main
  const chromePath = browserService.checkChromiumAvailable();
  if (!chromePath) {
    const { response } = await dialog.showMessageBox({
      type: "warning",
      title: "Không tìm thấy trình duyệt",
      message: "Ứng dụng cần Chrome hoặc Microsoft Edge để hoạt động.",
      detail:
        "Vui lòng cài đặt Google Chrome hoặc Microsoft Edge, sau đó khởi động lại ứng dụng.\n",
      buttons: ["Thoát", "Tải Google Chrome"],
      defaultId: 0,
      cancelId: 0
    });

    if (response === 1) {
      shell.openExternal("https://www.google.com/chrome");
    }
    app.quit();
    return;
  }

  console.log(`[Main] Chrome/Edge tìm thấy: ${chromePath}`);
  createWindow();
  console.log("[Main] Window created.");

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  SchedulerService.getInstance().stop();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

export { mainWindow };
