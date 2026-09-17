// =============================================================================
// server/blog/approval.ts
//
// The approve / reject decision, in ONE place (autoblog-parity SC-07).
//
// Two very different callers apply it: the admin panel, where someone clicks a
// button on a page they are authenticated on, and the Telegram webhook, where
// someone taps an inline button in a group chat. Duplicating the logic is how
// the two drift — the panel recording feedback the bot does not, or one of them
// forgetting a post can already have been decided.
//
// Idempotence is the property that matters, and it is not theoretical: Telegram
// redelivers an update it did not get a 2xx for, and an approval card lives in
// a chat where two people can tap it a second apart. Deciding twice must be a
// no-op that reports what already happened — never a second publish, and never
// a second feedback row teaching the generator the same lesson twice.
// =============================================================================
import { storage } from "../storage.js";
import type { BlogPost } from "#shared/schema.js";

export type BlogDecisionResult =
  | { ok: false; reason: "not_found" }
  | { ok: true; alreadyDecided: true; reason: "already_published" }
  | { ok: true; alreadyDecided: false; post: BlogPost };

export async function approveBlogPost(postId: number): Promise<BlogDecisionResult> {
  const post = await storage.getBlogPost(postId);
  if (!post) return { ok: false, reason: "not_found" };
  if (post.status === "published") return { ok: true, alreadyDecided: true, reason: "already_published" };

  const rssItem = await storage.getRssItemByUsedPostId(postId).catch(() => undefined);
  const updated = await storage.updateBlogPost(postId, {
    status: "published",
    publishedAt: post.publishedAt ?? new Date(),
  });
  await storage.createBlogPostFeedback({
    postId,
    postTitle: post.title,
    // Which feed item produced the post, so the signal says what was approved
    // about it and not only which title survived.
    sourceTitle: rssItem?.title ?? null,
    verdict: "approved",
    reason: null,
  });
  return { ok: true, alreadyDecided: false, post: updated };
}

/**
 * `reason` is deliberately NULL from the Telegram path. It is not an audit
 * trail — the generator splices it into the next prompt as "avoid whatever led
 * to this rejection". A tap on an inline button carries no editorial judgement,
 * so stamping one there would feed the model lines like "rejected from Telegram
 * by chat 123" and present that to it as a lesson. Reasons come from the admin
 * panel, where someone actually types one.
 */
export async function rejectBlogPost(postId: number, reason: string | null): Promise<BlogDecisionResult> {
  const post = await storage.getBlogPost(postId);
  if (!post) return { ok: false, reason: "not_found" };

  const rssItem = await storage.getRssItemByUsedPostId(postId).catch(() => undefined);
  await storage.createBlogPostFeedback({
    postId,
    postTitle: post.title,
    sourceTitle: rssItem?.title ?? null,
    verdict: "rejected",
    reason: reason?.trim() || null,
  });
  // Feedback first, deletion second: the row snapshots the title, so the signal
  // survives the post. In the other order a crash between the two loses the
  // lesson and leaves nothing to show for the rejection.
  await storage.deleteBlogPost(postId);
  return { ok: true, alreadyDecided: false, post };
}
