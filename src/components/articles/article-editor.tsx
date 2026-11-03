"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveArticleAction } from "@/server/actions/content";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Field, Panel, StatusBadge, controlClass, localizedName, useSavedRefresh } from "@/components/records/widgets";
import type { Article, Category } from "@/types";

export function ArticlesScreen({ articles, categories }: { articles: Article[]; categories: Category[] }) {
  const { t, locale } = useI18n();
  const names = new Map(categories.map((category) => [category.id, localizedName(category.name, locale)]));
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("articles.hint")}</p>
        <Button render={<Link href="/website/articles/new" />}>{t("articles.add")}</Button>
      </div>
      {articles.length === 0 ? <EmptyState>{t("articles.empty")}</EmptyState> : (
        <Panel>
          <ul className="divide-y divide-border">
            {articles.map((article) => (
              <li key={article.id} className="flex items-center justify-between gap-3 py-3">
                <Link className="font-medium text-primary" href={`/website/articles/${article.id}`}>{article.en.title || article.ar.title}</Link>
                <span className="text-sm text-muted-foreground">{names.get(article.categoryId)}</span>
                <StatusBadge value={article.status} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

export function ArticleEditor({ article, categories }: { article: Article | null; categories: Category[] }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { error, finish } = useSavedRefresh();
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState(article?.status ?? "draft");
  const [categoryId, setCategoryId] = useState(article?.categoryId || categories[0]?.id || "");
  const [publishDate, setPublishDate] = useState(article?.publishDate ?? "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState(article?.featuredImageUrl ?? "");
  const [content, setContent] = useState({ en: article?.en ?? blank(), ar: article?.ar ?? blank() });
  const [pending, setPending] = useState(false);
  const current = content[language];

  function update(patch: Partial<typeof current>) {
    setContent((value) => ({ ...value, [language]: { ...value[language], ...patch } }));
  }

  async function save() {
    setPending(true);
    const result = await saveArticleAction({
      categoryId,
      status,
      publishDate: publishDate || null,
      featuredImageUrl,
      en: content.en,
      ar: content.ar,
    }, article?.id);
    setPending(false);
    if (result.ok && result.data && !article) {
      router.push(`/website/articles/${result.data}`);
      return;
    }
    await finish(result);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("articles.hint")}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={language === "en" ? "default" : "outline"} onClick={() => setLanguage("en")}>{t("articles.english")}</Button>
        <Button type="button" variant={language === "ar" ? "default" : "outline"} onClick={() => setLanguage("ar")}>{t("articles.arabic")}</Button>
        <Button type="button" variant="outline" onClick={() => setPreview(true)}>{t("articles.preview")}</Button>
      </div>
      <Panel>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("fields.category")}>
              <select className={controlClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                {categories.map((category) => <option key={category.id} value={category.id}>{localizedName(category.name, locale)}</option>)}
              </select>
            </Field>
            <Field label={t("fields.status")}>
              <select className={controlClass} value={status} onChange={(event) => setStatus(event.target.value as Article["status"])}>
                <option value="draft">{t("status.draft")}</option>
                <option value="published">{t("status.published")}</option>
                <option value="archived">{t("status.archived")}</option>
              </select>
            </Field>
            <Field label={t("fields.publishDate")}><Input className="numeric h-10" type="date" value={publishDate} onChange={(event) => setPublishDate(event.target.value)} /></Field>
          </div>
          <Field label={t("fields.title")}><Input className="h-10" value={current.title} onChange={(event) => update({ title: event.target.value })} /></Field>
          <Field label={t("fields.slug")}><Input className="h-10" value={current.slug} onChange={(event) => update({ slug: event.target.value })} /></Field>
          <Field label={t("fields.excerpt")}><Input className="h-10" value={current.excerpt} onChange={(event) => update({ excerpt: event.target.value })} /></Field>
          <Field label={t("fields.content")}>
            <RichText key={language} initial={current.content} dir={language === "ar" ? "rtl" : "ltr"} onChange={(html) => update({ content: html })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.seoTitle")}><Input className="h-10" value={current.seoTitle} onChange={(event) => update({ seoTitle: event.target.value })} /></Field>
            <Field label={t("fields.metaDescription")}><Input className="h-10" value={current.metaDescription} onChange={(event) => update({ metaDescription: event.target.value })} /></Field>
          </div>
          <Field label={t("articles.imageUrl")}>
            <Input className="h-10" value={featuredImageUrl} placeholder="https://" onChange={(event) => setFeaturedImageUrl(event.target.value)} />
            <span className="text-xs text-muted-foreground">{t("articles.imageHint")}</span>
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div><Button type="button" disabled={pending} onClick={() => void save()}>{pending ? t("common.saving") : t("common.save")}</Button></div>
        </div>
      </Panel>
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
          <DialogHeader><DialogTitle>{current.title || t("articles.preview")}</DialogTitle></DialogHeader>
          <article dir={language === "ar" ? "rtl" : "ltr"} className="prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: current.content }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RichText({ initial, dir, onChange }: { initial: string; dir: "ltr" | "rtl"; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        <Tool label="B" command="bold" />
        <Tool label="I" command="italic" />
        <Tool label="H2" command="formatBlock" value="H2" />
        <Tool label="•" command="insertUnorderedList" />
        <Tool label="1." command="insertOrderedList" />
        <Button type="button" size="sm" variant="outline" onClick={() => {
          const url = window.prompt("https://");
          if (url) document.execCommand("createLink", false, url);
          onChange(ref.current?.innerHTML ?? "");
        }}>Link</Button>
      </div>
      <div
        ref={ref}
        contentEditable
        dir={dir}
        className="min-h-40 rounded-lg border border-input px-3 py-2 text-sm outline-none focus-visible:border-ring"
        dangerouslySetInnerHTML={{ __html: initial }}
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
      />
    </div>
  );
}

function Tool({ label, command, value }: { label: string; command: string; value?: string }) {
  return <Button type="button" size="sm" variant="outline" onMouseDown={(event) => { event.preventDefault(); document.execCommand(command, false, value); }}>{label}</Button>;
}

function blank() {
  return { title: "", slug: "", excerpt: "", content: "", seoTitle: "", metaDescription: "" };
}
