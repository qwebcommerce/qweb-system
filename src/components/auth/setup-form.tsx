"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createFirstAdministrator, type SetupError } from "@/server/actions/setup";
import { useI18n } from "@/components/providers/locale-provider";
import type { MessageKey } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  secret: z.string().min(1),
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
});

type SetupValues = z.infer<typeof schema>;

const errorKeys: Record<SetupError, MessageKey> = {
  unconfigured: "auth.unconfigured",
  bootstrapped: "auth.alreadyBootstrapped",
  invalid: "validation.required",
  secret: "auth.invalidSecret",
  exists: "auth.emailInUse",
  auth_disabled: "auth.authDisabled",
  failed: "auth.setupFailed",
};

export function SetupForm() {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<SetupValues>({
    resolver: zodResolver(schema),
    defaultValues: { secret: "", name: "", email: "", password: "" },
  });

  async function onSubmit(values: SetupValues) {
    setFormError(null);
    const result = await createFirstAdministrator(values);
    if (!result.ok) {
      setFormError(t(errorKeys[result.error]));
      return;
    }
    setDone(true);
    toast.success(t("auth.setupDone"));
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("auth.setupDone")}</p>
        <Button className="w-full" render={<Link href="/login" />}>
          {t("auth.goToSignIn")}
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Field
        id="secret"
        label={t("auth.setupSecret")}
        type="password"
        autoComplete="off"
        error={form.formState.errors.secret ? t("validation.required") : null}
        registration={form.register("secret")}
      />
      <Field
        id="name"
        label={t("common.fullName")}
        autoComplete="name"
        error={form.formState.errors.name ? t("validation.name") : null}
        registration={form.register("name")}
      />
      <Field
        id="email"
        label={t("common.email")}
        type="email"
        autoComplete="email"
        error={form.formState.errors.email ? t("validation.email") : null}
        registration={form.register("email")}
      />
      <Field
        id="password"
        label={t("common.password")}
        type="password"
        autoComplete="new-password"
        error={form.formState.errors.password ? t("validation.password") : null}
        registration={form.register("password")}
      />
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      <Button type="submit" className="h-10 w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t("auth.creating") : t("auth.createAdministrator")}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  registration,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  error: string | null;
  registration: ReturnType<ReturnType<typeof useForm<SetupValues>>["register"]>;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} autoComplete={autoComplete} className="h-10" aria-invalid={Boolean(error)} {...registration} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
