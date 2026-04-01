import fs from "fs";
import https from "https";
import path from "path";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { v4 as uuidv4 } from "uuid";
import { accountService } from "./account.service.js";
import { store } from "./store.js";
import { getRandomUserAgent, sendLog } from "./utils.js";

puppeteer.use(StealthPlugin());

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const JOB_ID = "api-facebook";

export interface ApiFacebookPostParams {
  accountId: string;
  groupUrls: string[];
  message: string;
  imagePaths?: string[];
  delayMin?: number; // ms, default 5000
  delayMax?: number; // ms, default 10000
}

export interface ApiFacebookPostResult {
  groupUrl: string;
  success: boolean;
  photoIds?: string[];
  error?: string;
}

interface FbSession {
  dtsg: string;
  uid: string;
  ua: string;
  cookieHeader: string;
}

/**
 * Hàm Upload ảnh lên Facebook trả về fbid
 * @param uid ID người dùng (c_user)
 * @param dtsg Mã fb_dtsg lấy từ Puppeteer/Trang chủ
 * @param cookieHeader Chuỗi cookie hoàn chỉnh
 * @param ua User-Agent của trình duyệt đang dùng
 * @param filePath Đường dẫn tuyệt đối đến file ảnh
 */
async function uploadPhotoRaw(
  uid: string,
  dtsg: string,
  cookieHeader: string,
  ua: string,
  filePath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 18)}`;
    const fileName = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);
    const mimeType = fileName.match(/\.(png)$/i) ? "image/png" : "image/jpeg";
    const uploadId = `jsc_c_${Math.floor(Math.random() * 10)}`;

    let dtsgSum = 0;
    for (let i = 0; i < dtsg.length; i++) {
      dtsgSum += dtsg.charCodeAt(i);
    }
    const jazoest = "2" + dtsgSum;

    const chunks: Buffer[] = [];

    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="source"\r\n\r\n8\r\n`));
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="profile_id"\r\n\r\n${uid}\r\n`));
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="waterfallxapp"\r\n\r\ncomet\r\n`));
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="farr"; filename="${fileName}"\r\n` +
          `Content-Type: ${mimeType}\r\n\r\n`
      )
    );
    chunks.push(fileContent);
    chunks.push(Buffer.from(`\r\n`));
    chunks.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="upload_id"\r\n\r\n${uploadId}\r\n`)
    );
    chunks.push(Buffer.from(`--${boundary}--\r\n`));

    const bodyBuffer = Buffer.concat(chunks);

    const searchParams = new URLSearchParams({
      av: uid,
      __user: uid,
      __a: "1",
      __req: "1f",
      __comet_req: "15",
      fb_dtsg: dtsg,
      jazoest: jazoest,
      __crn: "comet.fbweb.CometGroupDiscussionRoute"
    });

    const options = {
      hostname: "upload.facebook.com",
      path: `/ajax/react_composer/attachments/photo/upload?${searchParams.toString()}`,
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "content-length": bodyBuffer.length,
        cookie: cookieHeader,
        "user-agent": ua,
        origin: "https://www.facebook.com",
        referer: "https://www.facebook.com/",
        priority: "u=1, i",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site"
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const cleanJson = data.replace("for (;;);", "");
        try {
          const resObj = JSON.parse(cleanJson);
          if (resObj.payload && resObj.payload.photoID) {
            resolve(resObj.payload.photoID.toString());
          } else {
            reject(new Error("Lỗi upload: " + cleanJson));
          }
        } catch (e) {
          reject(new Error("Lỗi parse JSON: " + data));
        }
      });
    });

    req.on("error", reject);
    req.write(bodyBuffer);
    req.end();
  });
}

// ── Core steps ───
async function getFbSession(accountId: string): Promise<FbSession> {
  const account = accountService.getById(accountId);
  if (!account) throw new Error("Không tìm thấy account");

  const ua = getRandomUserAgent();

  const launchConfig: any = {
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-web-security",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--headless=true"
    ],
    userAgent: ua
  };

  // Try local Chrome / Edge
  try {
    const chromeLauncher = await import("chrome-launcher");
    const installs = chromeLauncher.Launcher.getInstallations();
    if (installs.length > 0) launchConfig.executablePath = installs[0];
  } catch {
    try {
      const { getEdgePath } = await import("edge-paths");
      const ep = getEdgePath();
      if (ep && fs.existsSync(ep)) launchConfig.executablePath = ep;
    } catch {
      // use bundled
    }
  }

  const browser = await puppeteer.launch(launchConfig);
  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());
  await page.setUserAgent(ua);

  // Load stored cookies
  const cookiesPath = store.getCookiesPath(account.email);
  if (fs.existsSync(cookiesPath)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf-8"));
      if (Array.isArray(cookies) && cookies.length > 0) {
        await page.setCookie(...cookies);
        sendLog(`[API Post] Loaded cookies cho ${account.email}`, "info", JOB_ID);
      }
    } catch {
      sendLog("[API Post] Không đọc được cookies", "warning", JOB_ID);
    }
  }

  sendLog("[API Post] Đang lấy fb_dtsg token...", "info", JOB_ID);
  await page.goto("https://www.facebook.com/", { waitUntil: "networkidle2", timeout: 60000 });

  // Extract dtsg from page HTML (most reliable method)
  let dtsg: string | null = null;
  let uid: string | null = null;

  const html: string = await page.content();

  // Method 1: JSON blob in HTML
  const dtsgMatch = html.match(/"DTSGInitialData"[^}]*"token":"([^"]+)"/);
  if (dtsgMatch) dtsg = dtsgMatch[1];

  // Method 2: evaluate
  if (!dtsg) {
    try {
      dtsg = await page.evaluate(() => {
        try {
          return window.require("DTSGInitialData")?.token ?? null;
        } catch {
          return null;
        }
      });
    } catch {
      /* ignore */
    }
  }

  // uid from cookie string
  uid = await page.evaluate(() => document.cookie.match(/c_user=(\d+)/)?.[1] ?? null);

  if (!dtsg || !uid) {
    await browser.close();
    throw new Error("Không lấy được fb_dtsg hoặc uid. Hãy đảm bảo account đã đăng nhập và cookie hợp lệ.");
  }

  const rawCookies = await page.cookies();
  const cookieHeader = rawCookies.map((c) => `${c.name}=${c.value}`).join("; ");

  await browser.close();
  sendLog(`[API Post] ✅ Session OK — uid: ${uid}`, "success", JOB_ID);

  return { dtsg, uid, ua, cookieHeader };
}

/** Resolve group numeric ID */
async function resolveGroupId(session: FbSession, groupUrl: string): Promise<string | null> {
  // Numeric ID directly in URL
  const numMatch = groupUrl.match(/\/groups\/(\d+)/);
  if (numMatch) return numMatch[1];

  // Named group — fetch HTML
  sendLog(`[API Post] Đang resolve Group ID từ: ${groupUrl}`, "info", JOB_ID);
  try {
    const res = await fetch(groupUrl, {
      headers: {
        cookie: session.cookieHeader,
        "user-agent": session.ua,
        accept: "text/html"
      }
    });
    const text = await res.text();
    const m = text.match(/"groupID":"?(\d+)"?/);
    if (m) return m[1];
    const m2 = text.match(/fb:\/\/group\/(\d+)/);
    if (m2) return m2[1];
  } catch (e: any) {
    sendLog(`[API Post] Lỗi resolve group: ${e.message}`, "warning", JOB_ID);
  }
  return null;
}

async function uploadPhoto(session: FbSession, imagePath: string): Promise<string | null> {
  if (!fs.existsSync(imagePath)) {
    sendLog(`[API Post] File ảnh không tồn tại: ${imagePath}`, "warning", JOB_ID);
    return null;
  }
  sendLog("[API Post] Đang upload ảnh...", "info", JOB_ID);
  try {
    const photoID = await uploadPhotoRaw(session.uid, session.dtsg, session.cookieHeader, session.ua, imagePath);
    if (photoID) sendLog(`[API Post] ✅ Photo ID: ${photoID}`, "success", JOB_ID);
    else sendLog("[API Post] Upload ảnh không trả về photo ID", "warning", JOB_ID);
    return photoID;
  } catch (e: any) {
    sendLog(`[API Post] Lỗi upload ảnh: ${e.message}`, "error", JOB_ID);
    return null;
  }
}

async function postToGroup(
  session: FbSession,
  targetId: string,
  message: string,
  photoIds?: string[] | null
): Promise<boolean> {
  let dtsgSum = 0;
  for (let i = 0; i < session.dtsg.length; i++) {
    dtsgSum += session.dtsg.charCodeAt(i);
  }
  const jazoest = "2" + dtsgSum;

  const sessionID = uuidv4();
  const variables = {
    input: {
      composer_entry_point: "inline_composer",
      composer_source_surface: "group",
      composer_type: "group",
      logging: { composer_session_id: sessionID },
      source: "WWW",
      message: { ranges: [], text: message },
      with_tags_ids: null,
      inline_activities: [],
      text_format_preset_id: "0",
      group_flair: { flair_id: null },
      attachments: photoIds && photoIds.length > 0 ? photoIds.map((id) => ({ photo: { id } })) : [],
      composed_text: {
        block_data: ["{}"],
        block_depths: [0],
        block_types: [0],
        blocks: [message || ""],
        entities: ["[]"],
        entity_map: "{}",
        inline_styles: ["[]"]
      },
      navigation_data: {
        attribution_id_v2: "CometGroupDiscussionRoot.react,comet.group,via_cold_start,1775053897822,686099,2361831622,,"
      },
      tracking: [null],
      event_share_metadata: { surface: "newsfeed" },
      audience: { to_id: targetId },
      actor_id: session.uid,
      client_mutation_id: "1"
    },
    feedLocation: "GROUP",
    feedbackSource: 0,
    focusCommentID: null,
    gridMediaWidth: null,
    groupID: null,
    scale: 1,
    privacySelectorRenderLocation: "COMET_STREAM",
    checkPhotosToReelsUpsellEligibility: false,
    referringStoryRenderLocation: null,
    renderLocation: "group",
    useDefaultActor: false,
    inviteShortLinkKey: null,
    isFeed: false,
    isFundraiser: false,
    isFunFactPost: false,
    isGroup: true,
    isEvent: false,
    isTimeline: false,
    isSocialLearning: false,
    isPageNewsFeed: false,
    isProfileReviews: false,
    isWorkSharedDraft: false,
    canUserManageOffers: false,
    __relay_internal__pv__CometUFIShareActionMigrationrelayprovider: true,
    __relay_internal__pv__GHLShouldChangeSponsoredDataFieldNamerelayprovider: true,
    __relay_internal__pv__GHLShouldChangeAdIdFieldNamerelayprovider: true,
    __relay_internal__pv__CometUFI_dedicated_comment_routable_dialog_gkrelayprovider: true,
    __relay_internal__pv__CometUFICommentAutoTranslationTyperelayprovider: "ORIGINAL",
    __relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider: false,
    __relay_internal__pv__CometUFICommentActionLinksRewriteEnabledrelayprovider: false,
    __relay_internal__pv__IsWorkUserrelayprovider: false,
    __relay_internal__pv__CometUFIReactionsEnableShortNamerelayprovider: false,
    __relay_internal__pv__CometUFISingleLineUFIrelayprovider: true,
    __relay_internal__pv__CometFeedStory_enable_post_permalink_white_space_clickrelayprovider: false,
    __relay_internal__pv__TestPilotShouldIncludeDemoAdUseCaserelayprovider: false,
    __relay_internal__pv__FBReels_deprecate_short_form_video_context_gkrelayprovider: false,
    __relay_internal__pv__FBReels_enable_view_dubbed_audio_type_gkrelayprovider: true,
    __relay_internal__pv__CometImmersivePhotoCanUserDisable3DMotionrelayprovider: false,
    __relay_internal__pv__WorkCometIsEmployeeGKProviderrelayprovider: false,
    __relay_internal__pv__IsMergQAPollsrelayprovider: false,
    __relay_internal__pv__FBReelsMediaFooter_comet_enable_reels_ads_gkrelayprovider: true,
    __relay_internal__pv__FBReelsIFUTileContent_reelsIFUPlayOnHoverrelayprovider: true,
    __relay_internal__pv__GroupsCometGYSJFeedItemHeightrelayprovider: 150,
    __relay_internal__pv__ShouldEnableBakedInTextStoriesrelayprovider: false,
    __relay_internal__pv__StoriesShouldIncludeFbNotesrelayprovider: false,
    __relay_internal__pv__groups_comet_use_glvrelayprovider: false,
    __relay_internal__pv__GHLShouldChangeSponsoredAuctionDistanceFieldNamerelayprovider: false,
    __relay_internal__pv__GHLShouldUseSponsoredAuctionLabelFieldNameV1relayprovider: false,
    __relay_internal__pv__GHLShouldUseSponsoredAuctionLabelFieldNameV2relayprovider: false
  };

  const params = new URLSearchParams({
    av: session.uid,
    __user: session.uid,
    __a: "1",
    __req: "34",
    __comet_req: "15",
    fb_dtsg: session.dtsg,
    jazoest: jazoest,
    __crn: "comet.fbweb.CometGroupDiscussionRoute",
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: "ComposerStoryCreateMutation",
    server_timestamps: "true",
    variables: JSON.stringify(variables),
    doc_id: "34968973896049748"
  });

  const reqBody = params.toString();

  const headers = {
    accept: "*/*",
    "content-type": "application/x-www-form-urlencoded",
    "content-length": Buffer.byteLength(reqBody),
    cookie: session.cookieHeader,
    "user-agent": session.ua,
    origin: "https://www.facebook.com",
    referer: "https://www.facebook.com/",
    priority: "u=1, i",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site"
  };

  const resText = await new Promise<string>((resolve, reject) => {
    const req = https.request(
      {
        hostname: "www.facebook.com",
        path: "/api/graphql/",
        method: "POST",
        headers
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.write(reqBody);
    req.end();
  });

  const hasError =
    resText.includes('"errors"') || resText.includes('"error_code"') || resText.includes("Authentication");

  if (hasError) {
    sendLog(`[API Post] Lỗi đăng bài từ Facebook: ${resText}`, "error", JOB_ID);
  } else {
    sendLog(`[API Post] Phản hồi GraphQL OK: ${resText.substring(0, 300)}...`, "info", JOB_ID);
  }

  return !hasError;
}

// ── Public entry ─────────────────────────────────────────────────────────────

export async function runApiFacebookPosts(params: ApiFacebookPostParams): Promise<ApiFacebookPostResult[]> {
  const { accountId, groupUrls, message, imagePaths, delayMin = 5000, delayMax = 10000 } = params;

  sendLog(`[API Post] Bắt đầu chiến dịch: ${groupUrls.length} group(s)`, "info", JOB_ID);

  const session = await getFbSession(accountId);

  let sharedPhotoIds: string[] = [];
  if (imagePaths && imagePaths.length > 0) {
    for (const imagePath of imagePaths) {
      const pid = await uploadPhoto(session, imagePath);
      if (pid) sharedPhotoIds.push(pid);
    }
  }

  const results: ApiFacebookPostResult[] = [];

  for (let i = 0; i < groupUrls.length; i++) {
    const url = groupUrls[i];
    sendLog(`[API Post] [${i + 1}/${groupUrls.length}] ${url}`, "info", JOB_ID);

    try {
      const targetId = await resolveGroupId(session, url);
      if (!targetId) {
        results.push({ groupUrl: url, success: false, error: "Không lấy được Group ID" });
        continue;
      }

      const ok = await postToGroup(session, targetId, message, sharedPhotoIds.length > 0 ? sharedPhotoIds : null);
      if (ok) {
        sendLog(`[API Post] ✅ Thành công: ${url}`, "success", JOB_ID);
        results.push({
          groupUrl: url,
          success: true,
          photoIds: sharedPhotoIds.length > 0 ? sharedPhotoIds : undefined
        });
      } else {
        sendLog(`[API Post] ❌ Thất bại: ${url}`, "error", JOB_ID);
        results.push({ groupUrl: url, success: false, error: "API Facebook trả về lỗi" });
      }
    } catch (err: any) {
      sendLog(`[API Post] Lỗi nhóm ${url}: ${err.message}`, "error", JOB_ID);
      results.push({ groupUrl: url, success: false, error: err.message });
    }

    if (i < groupUrls.length - 1) {
      const wait = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
      sendLog(`[API Post] ⏳ Nghỉ ${(wait / 1000).toFixed(1)}s...`, "info", JOB_ID);
      await sleep(wait);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  sendLog(
    `[API Post] Hoàn tất: ${successCount}/${results.length} thành công`,
    successCount === results.length ? "success" : "warning",
    JOB_ID
  );

  return results;
}
