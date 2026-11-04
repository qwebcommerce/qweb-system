"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getClientAuth } from "@/lib/firebase/client";
import { isPublicFirebaseConfigured } from "@/lib/firebase/public-config";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

type LoginValues = z.infer<typeof schema>;

export function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const configured = isPublicFirebaseConfigured();
  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      const credential = await signInWithEmailAndPassword(
        getClientAuth(),
        values.email.trim().toLowerCase(),
        values.password,
      );
      const idToken = await credential.user.getIdToken(true);
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const { signOut } = await import("firebase/auth");
        await signOut(getClientAuth());
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          step?: string;
          code?: string;
          detail?: string;
        } | null;
        setFormError(
          payload?.error === "unauthorized"
            ? t("auth.unauthorized")
            : payload?.step
              ? `${t("auth.invalidCredentials")} (${payload.step}${payload.code ? `: ${payload.code}` : ""}${payload.detail ? ` — ${payload.detail}` : ""})`
              : t("auth.invalidCredentials"),
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === "auth/user-disabled") setFormError(t("auth.disabled"));
      else if (code === "auth/too-many-requests") setFormError(t("auth.tooManyRequests"));
      else setFormError(t("auth.invalidCredentials"));
    }
  }

  if (!configured) {
    return (
      <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
        <p>{t("auth.unconfigured")}</p>
        <p className="mt-2">{t("auth.configuredHint")}</p>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">{t("common.email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          className="h-10"
          aria-invalid={Boolean(form.formState.errors.email)}
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-sm text-destructive">{t("validation.email")}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("common.password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className="h-10"
          aria-invalid={Boolean(form.formState.errors.password)}
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-sm text-destructive">{t("validation.password")}</p>
        ) : null}
      </div>
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      <Button type="submit" className="h-10 w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
      </Button>
    </form>
  );
}
