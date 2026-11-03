"use client";

import { LoginForm } from "@/components/auth/login-form";
import { useI18n } from "@/components/providers/locale-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginScreen() {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-semibold text-primary">{t("appName")}</p>
        <CardTitle className="text-xl">{t("auth.signIn")}</CardTitle>
        <CardDescription>{t("auth.signInSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
