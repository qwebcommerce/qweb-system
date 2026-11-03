"use server";

import { z } from "zod";
import { authorized } from "@/server/actions/guard";
import {
  createManagedUser,
  deleteCategory,
  dismissInboxItem,
  loadInbox,
  saveArticle,
  saveCategory,
  updateManagedUser,
  type CategoryKind,
  type InboxItem,
} from "@/server/services/content";
import type { ArticleStatus, Role } from "@/types";

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => text(max).min(1);
const optionalId = z.union([z.string().trim().min(1).max(120), z.literal(""), z.null()]).optional().transform((value) => value || null);
const kinds = ["expense", "revenue", "project", "article"] as const;

const categorySchema = z.object({
  kind: z.enum(kinds),
  nameEn: required(120),
  nameAr: required(120),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

const userSchema = z.object({
  email: z.string().trim().email().max(160),
  displayName: required(160),
  password: z.string().min(8).max(120),
  role: z.enum(["administrator", "manager", "staff"]),
  employeeId: optionalId,
});

const userUpdateSchema = userSchema.omit({ email: true, password: true }).extend({
  active: z.boolean(),
  password: z.union([z.string().min(8).max(120), z.literal("")]).optional(),
});

const contentSchema = z.object({
  title: required(180),
  slug: text(80),
  excerpt: text(300),
  content: text(100000),
  seoTitle: text(180),
  metaDescription: text(300),
});

const articleSchema = z.object({
  categoryId: required(120),
  status: z.enum(["draft", "published", "archived"]),
  publishDate: optionalId,
  featuredImageUrl: z.string().trim().max(2000).refine((value) => value === "" || /^https:\/\/\S+$/i.test(value)),
  en: contentSchema,
  ar: contentSchema,
});

export async function saveCategoryAction(input: unknown, id?: string) {
  const data = categorySchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("settings.manage", (user) => saveCategory(user, data.data.kind, {
    name: { en: data.data.nameEn, ar: data.data.nameAr },
    active: data.data.active,
    sortOrder: data.data.sortOrder,
  }, id));
}

export async function deleteCategoryAction(kind: CategoryKind, id: string) {
  if (!kinds.includes(kind)) return { ok: false, error: "invalid" } as const;
  return authorized("settings.manage", (user) => deleteCategory(user, kind, id).then(() => null));
}

export async function createUserAction(input: unknown) {
  const data = userSchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("settings.manage", (user) => createManagedUser(user, {
    ...data.data,
    role: data.data.role as Role,
    employeeId: data.data.employeeId,
  }));
}

export async function updateUserAction(id: string, input: unknown) {
  const data = userUpdateSchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("settings.manage", (user) => updateManagedUser(user, id, {
    displayName: data.data.displayName,
    role: data.data.role as Role,
    active: data.data.active,
    employeeId: data.data.employeeId,
    password: data.data.password || undefined,
  }).then(() => null));
}

export async function saveArticleAction(input: unknown, id?: string) {
  const data = articleSchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("articles.view", (user) => saveArticle(user, {
    ...data.data,
    status: data.data.status as ArticleStatus,
    publishDate: data.data.publishDate,
    featuredImageUrl: data.data.featuredImageUrl || null,
  }, id));
}

export async function inboxAction() {
  return authorized(null, (user) => loadInbox(user));
}

export async function dismissInboxAction(item: InboxItem) {
  if (!item?.dedupeKey || !item.type || !item.href) return { ok: false, error: "invalid" } as const;
  return authorized(null, (user) => dismissInboxItem(user, item).then(() => null));
}
