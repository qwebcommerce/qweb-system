import "server-only";
import type { DocumentData } from "firebase-admin/firestore";
import { collections } from "@/config/collections";
import { qatarToday } from "@/lib/dates";
import { sanitizeHtml } from "@/lib/html";
import { getAdminAuth } from "@/lib/firebase/admin";
import { can } from "@/config/permissions";
import { asIso, asNullable, asNumber, asText, database, stamp } from "@/server/db";
import { activityRecord } from "@/server/services/activity";
import { RecordError, staffEmployeeId } from "@/server/services/directory";
import type { Article, ArticleStatus, Category, LocalizedText, Role, SessionUser, UserProfile } from "@/types";

const categoryCollections = {
  expense: collections.expenseCategories,
  revenue: collections.revenueCategories,
  project: collections.projectTypes,
  article: collections.articleCategories,
} as const;

export type CategoryKind = keyof typeof categoryCollections;

function mapCategory(id: string, data: DocumentData): Category {
  const name = data.name ?? {};
  return {
    id,
    name: { en: asText(name.en), ar: asText(name.ar) },
    active: data.active !== false,
    sortOrder: asNumber(data.sortOrder),
    systemKey: asNullable(data.systemKey),
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: asText(data.createdBy),
  };
}

export async function listCategories(kind: CategoryKind) {
  const snapshot = await database().collection(categoryCollections[kind]).orderBy("sortOrder").limit(200).get();
  return snapshot.docs.map((doc) => mapCategory(doc.id, doc.data()));
}

export async function saveCategory(
  user: SessionUser,
  kind: CategoryKind,
  input: { name: LocalizedText; active: boolean; sortOrder: number },
  id?: string,
) {
  const ref = id ? database().collection(categoryCollections[kind]).doc(id) : database().collection(categoryCollections[kind]).doc();
  await database().runTransaction(async (tx) => {
    const existing = id ? await tx.get(ref) : null;
    if (id && !existing?.exists) throw new RecordError("not_found");
    tx.set(ref, {
      name: input.name,
      active: input.active,
      sortOrder: input.sortOrder,
      systemKey: existing?.data()?.systemKey ?? null,
      updatedAt: stamp(),
      ...(existing?.exists ? {} : { createdAt: stamp(), createdBy: user.uid }),
    }, { merge: true });
    tx.set(database().collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: existing?.exists ? "category.updated" : "category.created",
      module: "settings",
      recordId: ref.id,
      description: "Updated a category.",
      newValues: { kind, name: input.name.en, active: input.active },
    }));
  });
  return ref.id;
}

export async function deleteCategory(user: SessionUser, kind: CategoryKind, id: string) {
  const ref = database().collection(categoryCollections[kind]).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new RecordError("not_found");
  if (existing.data()?.systemKey) throw new RecordError("linked");
  const referenced = await categoryInUse(kind, id);
  if (referenced) throw new RecordError("linked");
  await ref.delete();
  await database().collection(collections.activityLogs).add(activityRecord({
    userId: user.uid,
    userName: user.displayName,
    action: "category.deleted",
    module: "settings",
    recordId: id,
    description: "Deleted an unused category.",
    previousValues: { kind, name: existing.data()?.name?.en ?? "" },
  }));
}

async function categoryInUse(kind: CategoryKind, id: string) {
  const db = database();
  if (kind === "expense") {
    const [expenses, schedules] = await Promise.all([
      db.collection(collections.expenses).where("categoryId", "==", id).limit(1).get(),
      db.collection(collections.recurringExpenses).where("categoryId", "==", id).limit(1).get(),
    ]);
    return !expenses.empty || !schedules.empty;
  }
  if (kind === "revenue") {
    const snapshot = await db.collection(collections.revenue).where("categoryId", "==", id).limit(1).get();
    return !snapshot.empty;
  }
  if (kind === "project") {
    const snapshot = await db.collection(collections.projects).where("typeId", "==", id).limit(1).get();
    return !snapshot.empty;
  }
  const snapshot = await db.collection(collections.articles).where("categoryId", "==", id).limit(1).get();
  return !snapshot.empty;
}

function mapUser(id: string, data: DocumentData): UserProfile {
  return {
    uid: id,
    email: asText(data.email),
    displayName: asText(data.displayName),
    role: data.role,
    active: data.active !== false,
    employeeId: asNullable(data.employeeId),
    photoURL: asNullable(data.photoURL),
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: asText(data.createdBy),
  };
}

export async function listUsers() {
  const snapshot = await database().collection(collections.users).orderBy("displayName").limit(200).get();
  return snapshot.docs.map((doc) => mapUser(doc.id, doc.data()));
}

export async function createManagedUser(
  actor: SessionUser,
  input: { email: string; displayName: string; password: string; role: Role; employeeId: string | null },
) {
  const auth = getAdminAuth();
  let uid = "";
  try {
    const created = await auth.createUser({ email: input.email, password: input.password, displayName: input.displayName });
    uid = created.uid;
    await auth.setCustomUserClaims(uid, { role: input.role, active: true });
    await database().collection(collections.users).doc(uid).set({
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      active: true,
      employeeId: input.employeeId,
      photoURL: null,
      createdAt: stamp(),
      updatedAt: stamp(),
      createdBy: actor.uid,
    });
  } catch (error) {
    if (uid) await auth.deleteUser(uid).catch(() => undefined);
    if (isEmailInUse(error)) throw new RecordError("conflict");
    throw error;
  }
  await database().collection(collections.activityLogs).add(activityRecord({
    userId: actor.uid,
    userName: actor.displayName,
    action: "user.created",
    module: "users",
    recordId: uid,
    description: "Created a user.",
    newValues: { email: input.email, role: input.role },
  }));
  return uid;
}

export async function updateManagedUser(
  actor: SessionUser,
  id: string,
  input: { displayName: string; role: Role; active: boolean; employeeId: string | null; password?: string },
) {
  if (actor.uid === id && (!input.active || input.role !== "administrator")) throw new RecordError("invalid");
  const ref = database().collection(collections.users).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new RecordError("not_found");
  const auth = getAdminAuth();
  await auth.updateUser(id, {
    displayName: input.displayName,
    disabled: !input.active,
    ...(input.password ? { password: input.password } : {}),
  });
  await auth.setCustomUserClaims(id, { role: input.role, active: input.active });
  if (!input.active) await auth.revokeRefreshTokens(id);
  await ref.set({
    displayName: input.displayName,
    role: input.role,
    active: input.active,
    employeeId: input.employeeId,
    updatedAt: stamp(),
  }, { merge: true });
  await database().collection(collections.activityLogs).add(activityRecord({
    userId: actor.uid,
    userName: actor.displayName,
    action: "user.updated",
    module: "users",
    recordId: id,
    description: "Updated a user.",
    previousValues: { role: existing.data()?.role, active: existing.data()?.active },
    newValues: { role: input.role, active: input.active },
  }));
}

function mapArticle(id: string, data: DocumentData): Article {
  const readContent = (value: DocumentData | undefined) => ({
    title: asText(value?.title),
    slug: asText(value?.slug),
    excerpt: asText(value?.excerpt),
    content: asText(value?.content),
    seoTitle: asText(value?.seoTitle),
    metaDescription: asText(value?.metaDescription),
  });
  return {
    id,
    featuredImageUrl: asNullable(data.featuredImageUrl),
    categoryId: asText(data.categoryId),
    authorId: asText(data.authorId),
    status: (data.status as ArticleStatus) ?? "draft",
    publishDate: asNullable(data.publishDate),
    en: readContent(data.en),
    ar: readContent(data.ar),
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: asText(data.createdBy),
  };
}

export async function listArticles() {
  const snapshot = await database().collection(collections.articles).orderBy("updatedAt", "desc").limit(100).get();
  return snapshot.docs.map((doc) => mapArticle(doc.id, doc.data()));
}

export async function getArticle(id: string) {
  const snapshot = await database().collection(collections.articles).doc(id).get();
  return snapshot.exists ? mapArticle(snapshot.id, snapshot.data()!) : null;
}

export async function saveArticle(
  user: SessionUser,
  input: {
    categoryId: string;
    status: ArticleStatus;
    publishDate: string | null;
    featuredImageUrl: string | null;
    en: Article["en"];
    ar: Article["ar"];
  },
  id?: string,
) {
  const ref = id ? database().collection(collections.articles).doc(id) : database().collection(collections.articles).doc();
  const en = cleanContent(input.en);
  const ar = cleanContent(input.ar);
  await assertSlugAvailable(ref.id, en.slug, ar.slug);
  await database().runTransaction(async (tx) => {
    const existing = id ? await tx.get(ref) : null;
    if (id && !existing?.exists) throw new RecordError("not_found");
    tx.set(ref, {
      categoryId: input.categoryId,
      status: input.status,
      publishDate: input.status === "published" ? input.publishDate ?? qatarToday() : input.publishDate,
      authorId: existing?.data()?.authorId ?? user.uid,
      featuredImageUrl: input.featuredImageUrl,
      en,
      ar,
      updatedAt: stamp(),
      ...(existing?.exists ? {} : { createdAt: stamp(), createdBy: user.uid }),
    }, { merge: true });
    tx.set(database().collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: existing?.exists ? "article.updated" : "article.created",
      module: "articles",
      recordId: ref.id,
      description: "Saved an article.",
      newValues: { status: input.status, title: en.title },
    }));
  });
  return ref.id;
}

export async function listActivity() {
  const snapshot = await database().collection(collections.activityLogs).orderBy("createdAt", "desc").limit(80).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    userId: asText(doc.data().userId),
    userName: asText(doc.data().userName),
    action: asText(doc.data().action),
    module: asText(doc.data().module),
    recordId: asText(doc.data().recordId),
    description: asText(doc.data().description),
    createdAt: asIso(doc.data().createdAt),
  }));
}

export interface InboxItem {
  dedupeKey: string;
  type: "expense_overdue" | "task_overdue" | "project_delayed" | "payroll_pending";
  href: string;
  title: string;
}

export async function loadInbox(user: SessionUser): Promise<InboxItem[]> {
  const today = qatarToday();
  const items: InboxItem[] = [];
  const db = database();
  if (can(user.role, "finance.view")) {
    const [overdue, projects, payroll] = await Promise.all([
      db.collection(collections.expenses).where("status", "==", "overdue").limit(12).get(),
      db.collection(collections.projects).where("status", "in", ["pending", "in_progress", "on_hold"]).limit(40).get(),
      db.collection(collections.payroll).where("status", "==", "pending").limit(20).get(),
    ]);
    overdue.docs.forEach((doc) => items.push({
      dedupeKey: `expense_overdue:${doc.id}`,
      type: "expense_overdue",
      href: "/finance/expenses",
      title: asText(doc.data().title),
    }));
    projects.docs
      .filter((doc) => asText(doc.data().plannedDeliveryDate) && asText(doc.data().plannedDeliveryDate) < today)
      .slice(0, 8)
      .forEach((doc) => items.push({
        dedupeKey: `project_delayed:${doc.id}`,
        type: "project_delayed",
        href: `/operations/projects/${doc.id}`,
        title: asText(doc.data().title),
      }));
    const month = today.slice(0, 7);
    const pendingPayroll = payroll.docs.filter((doc) => doc.data().month === month);
    if (pendingPayroll.length > 0) {
      items.push({
        dedupeKey: `payroll_pending:${month}`,
        type: "payroll_pending",
        href: "/finance/payroll",
        title: String(pendingPayroll.length),
      });
    }
  }
  if (can(user.role, "tasks.view")) {
    const employeeId = await staffEmployeeId(user);
    const taskQuery = user.role === "staff" && employeeId
      ? db.collection(collections.tasks).where("assignedToId", "==", employeeId).limit(80)
      : db.collection(collections.tasks).where("status", "in", ["pending", "in_progress"]).limit(40);
    if (user.role !== "staff" || employeeId) {
      const tasks = await taskQuery.get();
      tasks.docs
        .filter((doc) => asText(doc.data().taskDate) < today && doc.data().status !== "completed" && doc.data().status !== "cancelled")
        .slice(0, 8)
        .forEach((doc) => items.push({
          dedupeKey: `task_overdue:${doc.id}`,
          type: "task_overdue",
          href: "/operations/tasks",
          title: asText(doc.data().description),
        }));
    }
  }
  const hidden = await db.collection(collections.notifications).where("userId", "==", user.uid).limit(300).get();
  const dismissed = new Set(hidden.docs.filter((doc) => doc.data().dismissed === true).map((doc) => asText(doc.data().dedupeKey)));
  return items.filter((item) => !dismissed.has(item.dedupeKey)).slice(0, 20);
}

export async function dismissInboxItem(user: SessionUser, item: InboxItem) {
  const id = `${user.uid}_${item.dedupeKey}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 700);
  await database().collection(collections.notifications).doc(id).set({
    userId: user.uid,
    type: item.type,
    module: item.type,
    recordId: item.dedupeKey,
    dedupeKey: item.dedupeKey,
    read: true,
    dismissed: true,
    createdAt: stamp(),
  }, { merge: true });
}

function cleanContent(content: Article["en"]): Article["en"] {
  return {
    title: content.title.trim(),
    slug: slugify(content.slug || content.title),
    excerpt: content.excerpt.trim(),
    content: sanitizeHtml(content.content),
    seoTitle: content.seoTitle.trim(),
    metaDescription: content.metaDescription.trim(),
  };
}

function slugify(value: string) {
  const slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return slug || "article";
}

async function assertSlugAvailable(id: string, enSlug: string, arSlug: string) {
  const collection = database().collection(collections.articles);
  const [en, ar] = await Promise.all([
    collection.where("en.slug", "==", enSlug).limit(2).get(),
    collection.where("ar.slug", "==", arSlug).limit(2).get(),
  ]);
  const clash = [...en.docs, ...ar.docs].some((doc) => doc.id !== id);
  if (clash) throw new RecordError("conflict");
}

function isEmailInUse(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "auth/email-already-exists";
}
