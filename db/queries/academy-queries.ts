import { db } from "@/db/db";
import {
  academyCoursesTable,
  academyModulesTable,
  academyLessonsTable,
  academyResourcesTable,
  academyProgressTable,
  academyCommunityPostsTable,
  academyCommunityCommentsTable,
  academyCommunityLikesTable,
  InsertAcademyCourse,
  InsertAcademyModule,
  InsertAcademyLesson,
  InsertAcademyResource,
  InsertAcademyCommunityPost,
  InsertAcademyCommunityComment,
  SelectAcademyCourse,
  SelectAcademyModule,
  SelectAcademyLesson,
} from "@/db/schema/academy-schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { userSettingsTable } from "@/db/schema/user-settings-schema";

/* ----------------------------- Courses ----------------------------- */

export async function listPublishedCourses(): Promise<SelectAcademyCourse[]> {
  return db
    .select()
    .from(academyCoursesTable)
    .where(eq(academyCoursesTable.status, "published"))
    .orderBy(asc(academyCoursesTable.orderIndex), desc(academyCoursesTable.createdAt));
}

/** All courses regardless of status (admin only). */
export async function getAllCourses(): Promise<SelectAcademyCourse[]> {
  return db
    .select()
    .from(academyCoursesTable)
    .orderBy(asc(academyCoursesTable.orderIndex), desc(academyCoursesTable.createdAt));
}

export async function listAllCourses(): Promise<SelectAcademyCourse[]> {
  return db
    .select()
    .from(academyCoursesTable)
    .orderBy(asc(academyCoursesTable.orderIndex), desc(academyCoursesTable.createdAt));
}

export async function getCourseById(id: string): Promise<SelectAcademyCourse | undefined> {
  const rows = await db.select().from(academyCoursesTable).where(eq(academyCoursesTable.id, id)).limit(1);
  return rows[0];
}

export async function insertCourse(data: InsertAcademyCourse): Promise<SelectAcademyCourse> {
  const [row] = await db.insert(academyCoursesTable).values(data).returning();
  return row;
}

export async function updateCourseRow(id: string, data: Partial<InsertAcademyCourse>): Promise<SelectAcademyCourse> {
  const [row] = await db
    .update(academyCoursesTable)
    .set(data)
    .where(eq(academyCoursesTable.id, id))
    .returning();
  return row;
}

export async function deleteCourseRow(id: string): Promise<void> {
  await db.delete(academyCoursesTable).where(eq(academyCoursesTable.id, id));
}

/* ----------------------------- Modules ----------------------------- */

export async function listModulesByCourse(courseId: string): Promise<SelectAcademyModule[]> {
  return db
    .select()
    .from(academyModulesTable)
    .where(eq(academyModulesTable.courseId, courseId))
    .orderBy(asc(academyModulesTable.orderIndex));
}

export async function insertModule(data: InsertAcademyModule): Promise<SelectAcademyModule> {
  const [row] = await db.insert(academyModulesTable).values(data).returning();
  return row;
}

export async function updateModuleRow(id: string, data: Partial<InsertAcademyModule>): Promise<SelectAcademyModule> {
  const [row] = await db.update(academyModulesTable).set(data).where(eq(academyModulesTable.id, id)).returning();
  return row;
}

export async function deleteModuleRow(id: string): Promise<void> {
  await db.delete(academyModulesTable).where(eq(academyModulesTable.id, id));
}

export async function setModuleOrder(id: string, orderIndex: number): Promise<void> {
  await db.update(academyModulesTable).set({ orderIndex }).where(eq(academyModulesTable.id, id));
}

/* ----------------------------- Lessons ----------------------------- */

export async function listLessonsByCourse(courseId: string): Promise<SelectAcademyLesson[]> {
  return db
    .select()
    .from(academyLessonsTable)
    .where(eq(academyLessonsTable.courseId, courseId))
    .orderBy(asc(academyLessonsTable.orderIndex));
}

export async function listLessonsByModule(moduleId: string): Promise<SelectAcademyLesson[]> {
  return db
    .select()
    .from(academyLessonsTable)
    .where(eq(academyLessonsTable.moduleId, moduleId))
    .orderBy(asc(academyLessonsTable.orderIndex));
}

export async function getLessonById(id: string): Promise<SelectAcademyLesson | undefined> {
  const rows = await db.select().from(academyLessonsTable).where(eq(academyLessonsTable.id, id)).limit(1);
  return rows[0];
}

export async function insertLesson(data: InsertAcademyLesson): Promise<SelectAcademyLesson> {
  const [row] = await db.insert(academyLessonsTable).values(data).returning();
  return row;
}

export async function updateLessonRow(id: string, data: Partial<InsertAcademyLesson>): Promise<SelectAcademyLesson> {
  const [row] = await db.update(academyLessonsTable).set(data).where(eq(academyLessonsTable.id, id)).returning();
  return row;
}

export async function deleteLessonRow(id: string): Promise<void> {
  await db.delete(academyLessonsTable).where(eq(academyLessonsTable.id, id));
}

export async function setLessonOrder(id: string, orderIndex: number): Promise<void> {
  await db.update(academyLessonsTable).set({ orderIndex }).where(eq(academyLessonsTable.id, id));
}

/* ----------------------------- Resources ----------------------------- */

export async function listResourcesByLesson(lessonId: string) {
  return db
    .select()
    .from(academyResourcesTable)
    .where(eq(academyResourcesTable.lessonId, lessonId))
    .orderBy(asc(academyResourcesTable.createdAt));
}

export async function insertResource(data: InsertAcademyResource) {
  const [row] = await db.insert(academyResourcesTable).values(data).returning();
  return row;
}

export async function deleteResourceRow(id: string): Promise<void> {
  await db.delete(academyResourcesTable).where(eq(academyResourcesTable.id, id));
}

/* ----------------------------- Progress ----------------------------- */

export async function markLessonCompleteRow(userId: string, lessonId: string, courseId: string) {
  const [row] = await db
    .insert(academyProgressTable)
    .values({ userId, lessonId, courseId })
    .onConflictDoNothing()
    .returning();
  return row;
}

export async function getUserCourseProgress(userId: string, courseId: string) {
  return db
    .select()
    .from(academyProgressTable)
    .where(and(eq(academyProgressTable.userId, userId), eq(academyProgressTable.courseId, courseId)));
}

export async function getAllUserProgress(userId: string) {
  return db.select().from(academyProgressTable).where(eq(academyProgressTable.userId, userId));
}

export async function getMostRecentProgress(userId: string) {
  const rows = await db
    .select()
    .from(academyProgressTable)
    .where(eq(academyProgressTable.userId, userId))
    .orderBy(desc(academyProgressTable.completedAt))
    .limit(1);
  return rows[0];
}

export async function countCompletedLessons(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(academyProgressTable)
    .where(eq(academyProgressTable.userId, userId));
  return rows[0]?.count ?? 0;
}

/* ----------------------------- Community ----------------------------- */

export async function listCommunityPosts(category?: string) {
  // Hide scheduled announcements whose scheduledFor is still in the future.
  const visible = sql`(${academyCommunityPostsTable.scheduledFor} IS NULL OR ${academyCommunityPostsTable.scheduledFor} <= now())`;
  const where =
    category && category !== "all"
      ? and(eq(academyCommunityPostsTable.category, category), visible)
      : visible;
  return db
    .select()
    .from(academyCommunityPostsTable)
    .where(where)
    .orderBy(desc(academyCommunityPostsTable.isPinned), desc(academyCommunityPostsTable.createdAt));
}

export async function getCommunityMembers(): Promise<
  { userId: string; userEmail: string; displayName: string | null; postCount: number }[]
> {
  const rows = await db
    .select({
      userId: academyCommunityPostsTable.userId,
      userEmail: academyCommunityPostsTable.userEmail,
      displayName: userSettingsTable.displayName,
      postCount: sql<number>`count(*)`,
    })
    .from(academyCommunityPostsTable)
    .leftJoin(userSettingsTable, eq(userSettingsTable.userId, academyCommunityPostsTable.userId))
    .groupBy(academyCommunityPostsTable.userId, academyCommunityPostsTable.userEmail, userSettingsTable.displayName)
    .orderBy(desc(sql`count(*)`));

  return rows
    .filter((r) => !!r.userEmail)
    .map((r) => ({
      userId: r.userId,
      userEmail: r.userEmail as string,
      displayName: r.displayName ?? null,
      postCount: Number(r.postCount),
    }));
}

export async function getCommunityPostById(id: string) {
  const rows = await db.select().from(academyCommunityPostsTable).where(eq(academyCommunityPostsTable.id, id)).limit(1);
  return rows[0];
}

export async function insertCommunityPost(data: InsertAcademyCommunityPost) {
  const [row] = await db.insert(academyCommunityPostsTable).values(data).returning();
  return row;
}

export async function updateCommunityPostRow(id: string, data: Partial<InsertAcademyCommunityPost>) {
  const [row] = await db
    .update(academyCommunityPostsTable)
    .set(data)
    .where(eq(academyCommunityPostsTable.id, id))
    .returning();
  return row;
}

export async function deleteCommunityPostRow(id: string): Promise<void> {
  await db.delete(academyCommunityPostsTable).where(eq(academyCommunityPostsTable.id, id));
}

export async function listComments(postId: string) {
  return db
    .select()
    .from(academyCommunityCommentsTable)
    .where(eq(academyCommunityCommentsTable.postId, postId))
    .orderBy(asc(academyCommunityCommentsTable.createdAt));
}

export async function insertComment(data: InsertAcademyCommunityComment) {
  const [row] = await db.insert(academyCommunityCommentsTable).values(data).returning();
  await db
    .update(academyCommunityPostsTable)
    .set({ commentsCount: sql`${academyCommunityPostsTable.commentsCount} + 1` })
    .where(eq(academyCommunityPostsTable.id, data.postId));
  return row;
}

export async function deleteCommentRow(id: string, postId: string): Promise<void> {
  await db.delete(academyCommunityCommentsTable).where(eq(academyCommunityCommentsTable.id, id));
  await db
    .update(academyCommunityPostsTable)
    .set({ commentsCount: sql`GREATEST(${academyCommunityPostsTable.commentsCount} - 1, 0)` })
    .where(eq(academyCommunityPostsTable.id, postId));
}

export async function getComment(id: string) {
  const rows = await db
    .select()
    .from(academyCommunityCommentsTable)
    .where(eq(academyCommunityCommentsTable.id, id))
    .limit(1);
  return rows[0];
}

export async function hasLiked(postId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(academyCommunityLikesTable)
    .where(and(eq(academyCommunityLikesTable.postId, postId), eq(academyCommunityLikesTable.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function toggleLikeRow(postId: string, userId: string): Promise<{ liked: boolean }> {
  const existing = await hasLiked(postId, userId);
  if (existing) {
    await db
      .delete(academyCommunityLikesTable)
      .where(and(eq(academyCommunityLikesTable.postId, postId), eq(academyCommunityLikesTable.userId, userId)));
    await db
      .update(academyCommunityPostsTable)
      .set({ likesCount: sql`GREATEST(${academyCommunityPostsTable.likesCount} - 1, 0)` })
      .where(eq(academyCommunityPostsTable.id, postId));
    return { liked: false };
  }
  await db.insert(academyCommunityLikesTable).values({ postId, userId }).onConflictDoNothing();
  await db
    .update(academyCommunityPostsTable)
    .set({ likesCount: sql`${academyCommunityPostsTable.likesCount} + 1` })
    .where(eq(academyCommunityPostsTable.id, postId));
  return { liked: true };
}

export async function listLikedPostIds(userId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const rows = await db
    .select({ postId: academyCommunityLikesTable.postId })
    .from(academyCommunityLikesTable)
    .where(eq(academyCommunityLikesTable.userId, userId));
  return new Set(rows.map((r) => r.postId));
}

/* ----------------------------- CMS: Course tree ----------------------------- */

/** Full course tree: course + modules + lessons (admin editor). */
export async function getCourseWithModulesAndLessons(courseId: string) {
  const course = await getCourseById(courseId);
  if (!course) return undefined;
  const [modules, lessons] = await Promise.all([
    listModulesByCourse(courseId),
    listLessonsByCourse(courseId),
  ]);
  return { course, modules, lessons };
}

/** Deep-copy a course with all modules, lessons and resources. Returns the new course. */
export async function duplicateCourse(courseId: string): Promise<SelectAcademyCourse | undefined> {
  const source = await getCourseById(courseId);
  if (!source) return undefined;

  const { id, createdAt, updatedAt, ...rest } = source as any;
  const [newCourse] = await db
    .insert(academyCoursesTable)
    .values({
      ...rest,
      title: `${source.title} (Copy)`,
      status: "draft",
      isPublished: false,
      slug: null,
    })
    .returning();

  const modules = await listModulesByCourse(courseId);
  for (const mod of modules) {
    const { id: modId, createdAt: mc, updatedAt: mu, ...modRest } = mod as any;
    const [newModule] = await db
      .insert(academyModulesTable)
      .values({ ...modRest, courseId: newCourse.id })
      .returning();

    const lessons = await listLessonsByModule(modId);
    for (const lesson of lessons) {
      const { id: lessonId, createdAt: lc, updatedAt: lu, ...lessonRest } = lesson as any;
      const [newLesson] = await db
        .insert(academyLessonsTable)
        .values({ ...lessonRest, moduleId: newModule.id, courseId: newCourse.id })
        .returning();

      const resources = await db
        .select()
        .from(academyResourcesTable)
        .where(eq(academyResourcesTable.lessonId, lessonId));
      for (const res of resources) {
        const { id: resId, createdAt: rc, ...resRest } = res as any;
        await db.insert(academyResourcesTable).values({ ...resRest, lessonId: newLesson.id });
      }
    }
  }

  return newCourse;
}

/* ----------------------------- CMS: Stats & activity ----------------------------- */

export async function getAcademyStats() {
  const [courseStats] = await db
    .select({
      totalCourses: sql<number>`count(*)::int`,
      publishedCourses: sql<number>`count(*) filter (where ${academyCoursesTable.status} = 'published')::int`,
      draftCourses: sql<number>`count(*) filter (where ${academyCoursesTable.status} = 'draft')::int`,
      archivedCourses: sql<number>`count(*) filter (where ${academyCoursesTable.status} = 'archived')::int`,
    })
    .from(academyCoursesTable);

  const [lessonStats] = await db
    .select({ totalLessons: sql<number>`count(*)::int` })
    .from(academyLessonsTable);

  const [postStats] = await db
    .select({ communityPosts: sql<number>`count(*)::int` })
    .from(academyCommunityPostsTable);

  const [learnerStats] = await db
    .select({
      activeLearners: sql<number>`count(distinct ${academyProgressTable.userId})::int`,
      completedLessons: sql<number>`count(*)::int`,
    })
    .from(academyProgressTable);

  const totalLessons = lessonStats?.totalLessons ?? 0;
  const activeLearners = learnerStats?.activeLearners ?? 0;
  const completedLessons = learnerStats?.completedLessons ?? 0;
  // total possible = published lessons * active learners
  const totalPossible = totalLessons * Math.max(activeLearners, 1);
  const completionRate = totalPossible > 0 ? Math.round((completedLessons / totalPossible) * 100) : 0;

  return {
    totalCourses: courseStats?.totalCourses ?? 0,
    publishedCourses: courseStats?.publishedCourses ?? 0,
    draftCourses: courseStats?.draftCourses ?? 0,
    archivedCourses: courseStats?.archivedCourses ?? 0,
    totalLessons,
    communityPosts: postStats?.communityPosts ?? 0,
    activeLearners,
    completionRate,
  };
}

/** Last 10 progress events + community posts combined, newest first. */
export async function getRecentActivity() {
  const progress = await db
    .select({
      userId: academyProgressTable.userId,
      lessonTitle: academyLessonsTable.title,
      courseTitle: academyCoursesTable.title,
      at: academyProgressTable.completedAt,
    })
    .from(academyProgressTable)
    .leftJoin(academyLessonsTable, eq(academyProgressTable.lessonId, academyLessonsTable.id))
    .leftJoin(academyCoursesTable, eq(academyProgressTable.courseId, academyCoursesTable.id))
    .orderBy(desc(academyProgressTable.completedAt))
    .limit(10);

  const posts = await db
    .select({
      userEmail: academyCommunityPostsTable.userEmail,
      title: academyCommunityPostsTable.title,
      category: academyCommunityPostsTable.category,
      at: academyCommunityPostsTable.createdAt,
    })
    .from(academyCommunityPostsTable)
    .orderBy(desc(academyCommunityPostsTable.createdAt))
    .limit(10);

  const items = [
    ...progress.map((p) => ({
      type: "progress" as const,
      actor: p.userId,
      text: `completed "${p.lessonTitle ?? "a lesson"}" in ${p.courseTitle ?? "a course"}`,
      at: p.at as Date,
    })),
    ...posts.map((p) => ({
      type: "post" as const,
      actor: p.userEmail ?? "Someone",
      text: `posted "${p.title}" in ${p.category}`,
      at: p.at as Date,
    })),
  ];

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 10);
}

/* ----------------------------- CMS: Community admin ----------------------------- */

/** All posts including locked/announcements, full data. */
export async function getCommunityPostsForAdmin() {
  return db
    .select()
    .from(academyCommunityPostsTable)
    .orderBy(
      desc(academyCommunityPostsTable.isPinned),
      desc(academyCommunityPostsTable.createdAt)
    );
}

/** Posts with no comments yet. */
export async function getUnansweredPosts() {
  return db
    .select()
    .from(academyCommunityPostsTable)
    .where(eq(academyCommunityPostsTable.commentsCount, 0))
    .orderBy(desc(academyCommunityPostsTable.createdAt));
}
