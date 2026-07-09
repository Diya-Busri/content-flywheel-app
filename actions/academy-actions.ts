"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ActionResult } from "@/types/actions/actions-types";
import * as q from "@/db/queries/academy-queries";
import {
  InsertAcademyCourse,
  InsertAcademyModule,
  InsertAcademyLesson,
  SelectAcademyCourse,
  SelectAcademyModule,
  SelectAcademyLesson,
} from "@/db/schema/academy-schema";
import {
  generateCoursePlan,
  generateLessonPlan,
  type GeneratedCourse,
  type GeneratedLesson,
} from "@/lib/academy-ai";

function isAdminEmail(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  return !!adminEmail && email.trim().toLowerCase() === adminEmail;
}

async function requireUser(): Promise<{ userId: string; email: string }> {
  const { userId } = auth();
  if (!userId) throw new Error("Unauthorized");
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  return { userId, email };
}

async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const u = await requireUser();
  if (!isAdminEmail(u.email)) throw new Error("Forbidden");
  return u;
}

function ok<T>(data: T, message = "OK"): ActionResult<T> {
  return { isSuccess: true, message, data };
}
function fail<T>(error: unknown, fallback: string): ActionResult<T> {
  const msg = error instanceof Error ? error.message : fallback;
  return { isSuccess: false, message: msg };
}

/* ----------------------------- Courses ----------------------------- */

export async function createCourseAction(data: InsertAcademyCourse): Promise<ActionResult<SelectAcademyCourse>> {
  try {
    await requireAdmin();
    const row = await q.insertCourse(data);
    revalidatePath("/dashboard/academy/admin");
    revalidatePath("/dashboard/academy");
    return ok(row, "Course created");
  } catch (e) {
    return fail(e, "Failed to create course");
  }
}

export async function updateCourseAction(id: string, data: Partial<InsertAcademyCourse>): Promise<ActionResult<SelectAcademyCourse>> {
  try {
    await requireAdmin();
    const row = await q.updateCourseRow(id, data);
    revalidatePath("/dashboard/academy/admin");
    revalidatePath(`/dashboard/academy/${id}`);
    revalidatePath("/dashboard/academy");
    return ok(row, "Course updated");
  } catch (e) {
    return fail(e, "Failed to update course");
  }
}

export async function deleteCourseAction(id: string): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    await q.deleteCourseRow(id);
    revalidatePath("/dashboard/academy/admin");
    revalidatePath("/dashboard/academy");
    return ok(null, "Course deleted");
  } catch (e) {
    return fail(e, "Failed to delete course");
  }
}

export async function publishCourseAction(id: string, isPublished: boolean): Promise<ActionResult<SelectAcademyCourse>> {
  try {
    await requireAdmin();
    const row = await q.updateCourseRow(id, { isPublished });
    revalidatePath("/dashboard/academy/admin");
    revalidatePath("/dashboard/academy");
    return ok(row, isPublished ? "Course published" : "Course unpublished");
  } catch (e) {
    return fail(e, "Failed to update course");
  }
}

export async function duplicateCourseAction(courseId: string): Promise<ActionResult<SelectAcademyCourse>> {
  try {
    await requireAdmin();
    const row = await q.duplicateCourse(courseId);
    if (!row) throw new Error("Course not found");
    revalidatePath("/dashboard/academy/admin");
    return ok(row, "Course duplicated");
  } catch (e) {
    return fail(e, "Failed to duplicate course");
  }
}

export async function archiveCourseAction(courseId: string): Promise<ActionResult<SelectAcademyCourse>> {
  try {
    await requireAdmin();
    const row = await q.updateCourseRow(courseId, { status: "archived", isPublished: false });
    revalidatePath("/dashboard/academy/admin");
    revalidatePath("/dashboard/academy");
    return ok(row, "Course archived");
  } catch (e) {
    return fail(e, "Failed to archive course");
  }
}

export async function updateCourseStatusAction(
  courseId: string,
  status: "draft" | "published" | "archived"
): Promise<ActionResult<SelectAcademyCourse>> {
  try {
    await requireAdmin();
    const row = await q.updateCourseRow(courseId, {
      status,
      isPublished: status === "published",
    });
    revalidatePath("/dashboard/academy/admin");
    revalidatePath(`/dashboard/academy/${courseId}`);
    revalidatePath("/dashboard/academy");
    return ok(row, `Course set to ${status}`);
  } catch (e) {
    return fail(e, "Failed to update status");
  }
}

export async function updateCourseSlugAction(courseId: string, slug: string): Promise<ActionResult<SelectAcademyCourse>> {
  try {
    await requireAdmin();
    const row = await q.updateCourseRow(courseId, { slug: slug.trim() || null });
    revalidatePath("/dashboard/academy/admin");
    return ok(row, "Slug updated");
  } catch (e) {
    return fail(e, "Failed to update slug");
  }
}

export async function toggleCourseFeaturedAction(courseId: string): Promise<ActionResult<SelectAcademyCourse>> {
  try {
    await requireAdmin();
    const course = await q.getCourseById(courseId);
    if (!course) throw new Error("Course not found");
    const row = await q.updateCourseRow(courseId, { isFeatured: !course.isFeatured });
    revalidatePath("/dashboard/academy/admin");
    revalidatePath("/dashboard/academy");
    return ok(row, row.isFeatured ? "Course featured" : "Course unfeatured");
  } catch (e) {
    return fail(e, "Failed to toggle featured");
  }
}

export async function updateCourseImageAction(courseId: string, imageUrl: string): Promise<ActionResult<SelectAcademyCourse>> {
  try {
    await requireAdmin();
    const row = await q.updateCourseRow(courseId, { coverImageUrl: imageUrl || null });
    revalidatePath("/dashboard/academy/admin");
    revalidatePath("/dashboard/academy");
    return ok(row, "Cover image updated");
  } catch (e) {
    return fail(e, "Failed to update image");
  }
}

/* ----------------------------- Modules ----------------------------- */

export async function createModuleAction(data: InsertAcademyModule): Promise<ActionResult<SelectAcademyModule>> {
  try {
    await requireAdmin();
    const existing = await q.listModulesByCourse(data.courseId);
    const row = await q.insertModule({ ...data, orderIndex: data.orderIndex ?? existing.length });
    revalidatePath("/dashboard/academy/admin");
    return ok(row, "Module created");
  } catch (e) {
    return fail(e, "Failed to create module");
  }
}

export async function updateModuleAction(id: string, data: Partial<InsertAcademyModule>): Promise<ActionResult<SelectAcademyModule>> {
  try {
    await requireAdmin();
    const row = await q.updateModuleRow(id, data);
    revalidatePath("/dashboard/academy/admin");
    return ok(row, "Module updated");
  } catch (e) {
    return fail(e, "Failed to update module");
  }
}

export async function deleteModuleAction(id: string): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    await q.deleteModuleRow(id);
    revalidatePath("/dashboard/academy/admin");
    return ok(null, "Module deleted");
  } catch (e) {
    return fail(e, "Failed to delete module");
  }
}

export async function reorderModulesAction(orderedIds: string[]): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    await Promise.all(orderedIds.map((id, i) => q.setModuleOrder(id, i)));
    revalidatePath("/dashboard/academy/admin");
    return ok(null, "Modules reordered");
  } catch (e) {
    return fail(e, "Failed to reorder modules");
  }
}

/* ----------------------------- Lessons ----------------------------- */

export async function createLessonAction(data: InsertAcademyLesson): Promise<ActionResult<SelectAcademyLesson>> {
  try {
    await requireAdmin();
    const existing = await q.listLessonsByModule(data.moduleId);
    const row = await q.insertLesson({ ...data, orderIndex: data.orderIndex ?? existing.length });
    revalidatePath("/dashboard/academy/admin");
    revalidatePath(`/dashboard/academy/${data.courseId}`);
    return ok(row, "Lesson created");
  } catch (e) {
    return fail(e, "Failed to create lesson");
  }
}

export async function updateLessonAction(id: string, data: Partial<InsertAcademyLesson>): Promise<ActionResult<SelectAcademyLesson>> {
  try {
    await requireAdmin();
    const row = await q.updateLessonRow(id, data);
    revalidatePath("/dashboard/academy/admin");
    if (row?.courseId) revalidatePath(`/dashboard/academy/${row.courseId}`);
    return ok(row, "Lesson updated");
  } catch (e) {
    return fail(e, "Failed to update lesson");
  }
}

export async function deleteLessonAction(id: string): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    await q.deleteLessonRow(id);
    revalidatePath("/dashboard/academy/admin");
    return ok(null, "Lesson deleted");
  } catch (e) {
    return fail(e, "Failed to delete lesson");
  }
}

export async function reorderLessonsAction(orderedIds: string[]): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    await Promise.all(orderedIds.map((id, i) => q.setLessonOrder(id, i)));
    revalidatePath("/dashboard/academy/admin");
    return ok(null, "Lessons reordered");
  } catch (e) {
    return fail(e, "Failed to reorder lessons");
  }
}

/* ----------------------------- Resources ----------------------------- */

export async function createResourceAction(data: {
  lessonId: string;
  title: string;
  url: string;
  fileType?: string;
}): Promise<ActionResult<any>> {
  try {
    await requireAdmin();
    const row = await q.insertResource(data);
    revalidatePath("/dashboard/academy/admin");
    return ok(row, "Resource added");
  } catch (e) {
    return fail(e, "Failed to add resource");
  }
}

export async function deleteResourceAction(id: string): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    await q.deleteResourceRow(id);
    revalidatePath("/dashboard/academy/admin");
    return ok(null, "Resource deleted");
  } catch (e) {
    return fail(e, "Failed to delete resource");
  }
}

/* ----------------------------- Progress ----------------------------- */

export async function markLessonCompleteAction(lessonId: string, courseId: string): Promise<ActionResult<null>> {
  try {
    const { userId } = await requireUser();
    await q.markLessonCompleteRow(userId, lessonId, courseId);
    revalidatePath(`/dashboard/academy/${courseId}`);
    revalidatePath("/dashboard/academy");
    revalidatePath("/dashboard");
    return ok(null, "Lesson completed");
  } catch (e) {
    return fail(e, "Failed to mark complete");
  }
}

export async function getUserProgressAction(): Promise<ActionResult<any[]>> {
  try {
    const { userId } = await requireUser();
    const rows = await q.getAllUserProgress(userId);
    return ok(rows);
  } catch (e) {
    return fail(e, "Failed to fetch progress");
  }
}

export async function getCourseProgressAction(courseId: string): Promise<ActionResult<any[]>> {
  try {
    const { userId } = await requireUser();
    const rows = await q.getUserCourseProgress(userId, courseId);
    return ok(rows);
  } catch (e) {
    return fail(e, "Failed to fetch progress");
  }
}

/* ----------------------------- Community ----------------------------- */

export async function createPostAction(data: {
  title: string;
  content: string;
  category?: string;
  imageUrls?: string;
}): Promise<ActionResult<any>> {
  try {
    const { userId, email } = await requireUser();
    const category = isAdminEmail(email) && data.category === "admin" ? "admin" : data.category || "general";
    const row = await q.insertCommunityPost({
      userId,
      userEmail: email,
      title: data.title,
      content: data.content,
      category,
      imageUrls: data.imageUrls,
    });
    revalidatePath("/dashboard/academy/community");
    return ok(row, "Post created");
  } catch (e) {
    return fail(e, "Failed to create post");
  }
}

export async function deletePostAction(id: string): Promise<ActionResult<null>> {
  try {
    const { userId, email } = await requireUser();
    const post = await q.getCommunityPostById(id);
    if (!post) throw new Error("Post not found");
    if (post.userId !== userId && !isAdminEmail(email)) throw new Error("Forbidden");
    await q.deleteCommunityPostRow(id);
    revalidatePath("/dashboard/academy/community");
    return ok(null, "Post deleted");
  } catch (e) {
    return fail(e, "Failed to delete post");
  }
}

export async function pinPostAction(id: string, isPinned: boolean): Promise<ActionResult<any>> {
  try {
    await requireAdmin();
    const row = await q.updateCommunityPostRow(id, { isPinned });
    revalidatePath("/dashboard/academy/community");
    return ok(row, isPinned ? "Post pinned" : "Post unpinned");
  } catch (e) {
    return fail(e, "Failed to pin post");
  }
}

export async function featurePostAction(id: string, isFeatured: boolean): Promise<ActionResult<any>> {
  try {
    await requireAdmin();
    const row = await q.updateCommunityPostRow(id, { isFeatured });
    revalidatePath("/dashboard/academy/community");
    return ok(row, isFeatured ? "Post featured" : "Post unfeatured");
  } catch (e) {
    return fail(e, "Failed to feature post");
  }
}

export async function lockPostAction(id: string): Promise<ActionResult<any>> {
  try {
    await requireAdmin();
    const post = await q.getCommunityPostById(id);
    if (!post) throw new Error("Post not found");
    const row = await q.updateCommunityPostRow(id, { isLocked: !post.isLocked });
    revalidatePath("/dashboard/academy/community");
    return ok(row, row.isLocked ? "Post locked" : "Post unlocked");
  } catch (e) {
    return fail(e, "Failed to lock post");
  }
}

export async function createAnnouncementAction(data: {
  title: string;
  content: string;
  category?: string;
  scheduledFor?: string | null;
}): Promise<ActionResult<any>> {
  try {
    const { userId, email } = await requireAdmin();
    const row = await q.insertCommunityPost({
      userId,
      userEmail: email,
      title: data.title,
      content: data.content,
      category: data.category || "admin",
      isAnnouncement: true,
      isPinned: true,
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
    });
    revalidatePath("/dashboard/academy/community");
    revalidatePath("/dashboard/academy/admin");
    return ok(row, data.scheduledFor ? "Announcement scheduled" : "Announcement posted");
  } catch (e) {
    return fail(e, "Failed to create announcement");
  }
}

export async function createCommentAction(postId: string, content: string): Promise<ActionResult<any>> {
  try {
    const { userId, email } = await requireUser();
    const post = await q.getCommunityPostById(postId);
    if (post?.isLocked) throw new Error("This post is locked");
    const row = await q.insertComment({ postId, userId, userEmail: email, content });
    revalidatePath(`/dashboard/academy/community/${postId}`);
    revalidatePath("/dashboard/academy/community");
    return ok(row, "Comment added");
  } catch (e) {
    return fail(e, "Failed to add comment");
  }
}

export async function deleteCommentAction(id: string, postId: string): Promise<ActionResult<null>> {
  try {
    const { userId, email } = await requireUser();
    const comment = await q.getComment(id);
    if (!comment) throw new Error("Comment not found");
    if (comment.userId !== userId && !isAdminEmail(email)) throw new Error("Forbidden");
    await q.deleteCommentRow(id, postId);
    revalidatePath(`/dashboard/academy/community/${postId}`);
    return ok(null, "Comment deleted");
  } catch (e) {
    return fail(e, "Failed to delete comment");
  }
}

export async function toggleLikeAction(postId: string): Promise<ActionResult<{ liked: boolean }>> {
  try {
    const { userId } = await requireUser();
    const res = await q.toggleLikeRow(postId, userId);
    revalidatePath(`/dashboard/academy/community/${postId}`);
    revalidatePath("/dashboard/academy/community");
    return ok(res, res.liked ? "Liked" : "Unliked");
  } catch (e) {
    return fail(e, "Failed to toggle like");
  }
}

/* ----------------------------- AI generation ----------------------------- */

export async function generateCourseAIAction(title: string): Promise<ActionResult<GeneratedCourse>> {
  try {
    await requireAdmin();
    if (!title.trim()) throw new Error("Title is required");
    const result = await generateCoursePlan(title.trim());
    return ok(result, "Course generated");
  } catch (e) {
    return fail(e, "Failed to generate course");
  }
}

export async function generateLessonAIAction(
  lessonTitle: string,
  courseTitle: string
): Promise<ActionResult<GeneratedLesson>> {
  try {
    await requireAdmin();
    if (!lessonTitle.trim()) throw new Error("Lesson title is required");
    const result = await generateLessonPlan(lessonTitle.trim(), courseTitle.trim());
    return ok(result, "Lesson suggestions generated");
  } catch (e) {
    return fail(e, "Failed to generate lesson");
  }
}
