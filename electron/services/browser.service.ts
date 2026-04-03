/**
 * browser.service.ts — Thin orchestrator
 *
 * Re-exports a unified `browserService` object so that ipc/index.ts
 * and main/index.ts don't need to change their imports.
 */

export { BrowserLauncherService, browserLauncher } from "./browser-launcher.service";
export { FacebookAuthService, facebookAuth } from "./facebook-auth.service";
export { FacebookCommentService, facebookComment } from "./facebook-comment.service";
export { FacebookPostService, facebookPost } from "./facebook-post.service";

import { browserLauncher } from "./browser-launcher.service";
import { facebookAuth } from "./facebook-auth.service";
import { facebookComment } from "./facebook-comment.service";
import { facebookPost } from "./facebook-post.service";

export const browserService = {
  // Browser detection (used by main/index.ts on startup)
  checkChromiumAvailable: () => browserLauncher.checkChromiumAvailable(),

  // Auth
  loginToFacebook: (accountId: string, campaignId?: string) =>
    facebookAuth.loginToFacebook(accountId, campaignId),

  // Post campaign
  runCampaign: (
    accountId: string,
    content: string,
    images: string[],
    groups: string[],
    maxConcurrent: number,
    campaignId: string
  ) => facebookPost.runCampaign(accountId, content, images, groups, maxConcurrent, campaignId),

  stopCampaign: (campaignId: string) => facebookPost.stopCampaign(campaignId),

  // Comment campaign
  runCommentCampaign: (
    accountId: string,
    posts: { id: string; postUrl: string }[],
    comments: { text: string; images: string[] }[],
    delayBetweenComments: number,
    delayBetweenPosts: number,
    campaignId: string
  ) =>
    facebookComment.runCommentCampaign(
      accountId,
      posts,
      comments,
      delayBetweenComments,
      delayBetweenPosts,
      campaignId
    )
};
