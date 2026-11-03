"use client";

import Link from "next/link";
import { SetupForm } from "@/components/auth/setup-form";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SetupScreen({ state }: { state: "unconfigured" | "open" | "done" }) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-semibold text-primary">{t("appName")}</p>
        <CardTitle className="text-xl">{t("auth.setupTitle")}</CardTitle>
        <CardDescription>
          {state === "done"
            ? t("auth.alreadyBootstrapped")
            : state === "unconfigured"
              ? t("auth.unconfigured")
              : t("auth.setupSubtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state === "open" ? <SetupForm /> : null}
        {state === "unconfigured" ? (
          <p className="text-sm text-muted-foreground">{t("auth.configuredHint")}</p>
        ) : null}
        {state === "done" ? (
          <Button className="w-full" render={<Link href="/login" />}>
            {t("auth.goToSignIn")}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
