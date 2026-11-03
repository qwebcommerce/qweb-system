"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/locale-provider";

export function ThemeToggle({
  className,
  variant = "outline",
}: {
  className?: string;
  variant?: "outline" | "ghost";
}) {
  const { setTheme } = useTheme();
  const { t } = useI18n();

  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      className={className}
      aria-label={t("common.theme")}
      onClick={() => {
        const isDark = document.documentElement.classList.contains("dark");
        setTheme(isDark ? "light" : "dark");
      }}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}
