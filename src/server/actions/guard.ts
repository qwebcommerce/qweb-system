import "server-only";
import { can, type Permission } from "@/config/permissions";
import { getSessionUser } from "@/server/auth/session";
import { RecordError } from "@/server/services/directory";
import type { SessionUser } from "@/types";

export type ActionError = "invalid" | "forbidden" | "not_found" | "conflict" | "linked" | "failed";
export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: ActionError };

export async function authorized<T>(
  permission: Permission | null,
  action: (user: SessionUser) => Promise<T>,
): Promise<ActionResult<T>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "forbidden" };
  if (permission && !can(user.role, permission)) return { ok: false, error: "forbidden" };
  try {
    return { ok: true, data: await action(user) };
  } catch (error) {
    if (error instanceof RecordError) return { ok: false, error: error.code };
    return { ok: false, error: "failed" };
  }
}
