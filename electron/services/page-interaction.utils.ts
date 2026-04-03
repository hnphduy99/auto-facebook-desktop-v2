import { Page } from "puppeteer";
import { randomDelay } from "./utils";

export const DELAYS = {
  MIN_ACTION: 1000,
  MAX_ACTION: 3000,
  AFTER_POST: 3000
};

export async function simulatePaste(page: Page, selector: string, text: string): Promise<void> {
  try {
    await page.focus(selector);
    await page.click(selector);

    const isMac = process.platform === "darwin";
    const modifier = isMac ? "Meta" : "Control";

    await page.keyboard.down(modifier);
    await page.keyboard.press("A");
    await page.keyboard.up(modifier);
    await page.keyboard.press("Backspace");

    await randomDelay(100, 300);

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line) {
        if (line.endsWith(".")) {
          const content = line.slice(0, -1);
          if (content) {
            await page.evaluate((txt) => {
              document.execCommand("insertText", false, txt);
            }, content);
          }
          await page.keyboard.type(".");
          await randomDelay(50, 100);
        } else {
          await page.evaluate((txt) => {
            document.execCommand("insertText", false, txt);
          }, line);
        }
      }
      if (i < lines.length - 1) {
        await page.keyboard.down("Shift");
        await page.keyboard.press("Enter");
        await page.keyboard.up("Shift");
        await randomDelay(50, 150);
      }
    }
  } catch {
    // Fallback: type each character
    try {
      await page.click(selector);
      for (const char of text) {
        if (char === "\n") {
          await page.keyboard.down("Shift");
          await page.keyboard.press("Enter");
          await page.keyboard.up("Shift");
        } else {
          await page.keyboard.type(char);
        }
      }
    } catch {
      // ignore
    }
  }
}
