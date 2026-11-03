import { ar } from "@/i18n/ar";
import { en, type MessageTree } from "@/i18n/en";
import type { Locale } from "@/types";

export type MessageKey = Leaves<MessageTree>;

type Leaves<T, Prefix extends string = ""> = T extends string
  ? Prefix
  : {
      [Key in keyof T & string]: Leaves<T[Key], Prefix extends "" ? Key : `${Prefix}.${Key}`>;
    }[keyof T & string];

const dictionaries = { en, ar };

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const value = key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dictionaries[locale]);

  const template = typeof value === "string" ? value : key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}

export function dictionaryKeys(tree: object = en, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") return [path];
    if (value && typeof value === "object") return dictionaryKeys(value, path);
    return [];
  });
}
