"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteArticleAction, saveArticleAction } from "@/server/actions/content";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateText, EmptyState, Field, Panel, StatusBadge, controlClass, localizedName, useSavedRefresh } from "@/components/records/widgets";
import type { Article, ArticleContent, Category } from "@/types";

export function ArticlesScreen({ articles, categories }: { articles: Article[]; categories: Category[] }) {
  const { t, locale } = useI18n();
  const { error, finish } = useSavedRefresh();
  const [viewing, setViewing] = useState<Article | null>(null);
  const [viewLanguage, setViewLanguage] = useState<"en" | "ar">(locale);
  const [removing, setRemoving] = useState<Article | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const names = new Map(categories.map((category) => [category.id, localizedName(category.name, locale)]));

  async function remove() {
    if (!removing) return;
    setPendingDelete(true);
    const result = await deleteArticleAction(removing.id);
    setPendingDelete(false);
    await finish(result, () => setRemoving(null));
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-sm text-muted-foreground">{t("articles.hint")}</p>
        <Button className="h-10 w-full sm:w-auto" render={<Link href="/website/articles/new" />}>{t("articles.add")}</Button>
      </div>
      {articles.length === 0 ? <EmptyState>{t("articles.empty")}</EmptyState> : (
        <Panel className="min-w-0 overflow-hidden p-0 md:p-0">
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[52rem] table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-[34%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.title")}</th>
                  <th className="w-[16%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.category")}</th>
                  <th className="w-[16%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.date")}</th>
                  <th className="w-[12%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.status")}</th>
                  <th className="w-[22%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => {
                  const copy = articleCopy(article, locale);
                  return (
                    <tr key={article.id} className="border-t border-[#550000]/10">
                      <td className="px-3 py-3 text-start md:px-5">
                        <p className="font-medium break-words">{copy.title || "—"}</p>
                        {copy.excerpt ? <p className="mt-1 line-clamp-2 text-xs break-words text-muted-foreground">{copy.excerpt}</p> : null}
                      </td>
                      <td className="px-3 py-3 text-start break-words md:px-5">{names.get(article.categoryId) || "—"}</td>
                      <td className="px-3 py-3 text-start whitespace-nowrap md:px-5"><DateText value={article.publishDate || article.updatedAt} /></td>
                      <td className="px-3 py-3 text-start md:px-5"><StatusBadge value={article.status} /></td>
                      <td className="px-3 py-3 text-start md:px-5">
                        <div className="flex flex-wrap items-center gap-1">
                          <Button type="button" variant="outline" size="sm" onClick={() => { setViewLanguage(locale); setViewing(article); }}>{t("common.view")}</Button>
                          <Button type="button" variant="outline" size="sm" render={<Link href={`/website/articles/${article.id}`} />}>{t("common.edit")}</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(article)}>{t("common.delete")}</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {viewing ? <ArticleView article={viewing} category={names.get(viewing.categoryId) || "—"} language={viewLanguage} onLanguage={setViewLanguage} onClose={() => setViewing(null)} /> : null}
      {removing ? (
        <Dialog open onOpenChange={(open) => { if (!open && !pendingDelete) setRemoving(null); }}>
          <DialogContent className="sm:max-w-md" showCloseButton={false}>
            <DialogHeader><DialogTitle>{t("common.delete")}</DialogTitle></DialogHeader>
            <p className="text-sm leading-6">{t("articles.deleteConfirm")}</p>
            <p className="text-sm font-medium break-words">{articleCopy(removing, locale).title}</p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pendingDelete} onClick={() => setRemoving(null)}>{t("common.cancel")}</Button>
              <Button type="button" variant="destructive" disabled={pendingDelete} onClick={() => void remove()}>{t("common.delete")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
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
    if (!result.ok) {
      await finish(result);
      return;
    }
    toast.success(t("common.saved"));
    router.push("/website/articles");
    router.refresh();
  }

  return (
    <div className="flex w-full flex-col gap-4">
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
          <Field label={t("fields.excerpt")}><Input className="h-10" value={current.excerpt} onChange={(event) => update({ excerpt: event.target.value })} /></Field>
          <div className="space-y-2">
            <span className="text-sm font-medium">{t("fields.content")}</span>
            <RichText key={language} initial={current.content} dir={language === "ar" ? "rtl" : "ltr"} onChange={(html) => update({ content: html })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.seoTitle")}><Input className="h-10" value={current.seoTitle} onChange={(event) => update({ seoTitle: event.target.value })} /></Field>
            <Field label={t("fields.metaDescription")}><Input className="h-10" value={current.metaDescription} onChange={(event) => update({ metaDescription: event.target.value })} /></Field>
          </div>
          <Field label={t("articles.imageUrl")}>
            <Input className="h-10" value={featuredImageUrl} placeholder="https://" onChange={(event) => setFeaturedImageUrl(event.target.value)} />
            <span className="text-xs text-muted-foreground">{t("articles.imageHint")}</span>
            <ArticleImage url={featuredImageUrl} alt={current.title || t("articles.imageUrl")} />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div><Button type="button" disabled={pending} onClick={() => void save()}>{pending ? t("common.saving") : t("common.save")}</Button></div>
        </div>
      </Panel>
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
          <DialogHeader><DialogTitle>{current.title || t("articles.preview")}</DialogTitle></DialogHeader>
          <ArticleImage url={featuredImageUrl} alt={current.title || t("articles.preview")} />
          <article dir={language === "ar" ? "rtl" : "ltr"} className="prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: current.content }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArticleImage({ url, alt }: { url: string; alt: string }) {
  const source = /^https:\/\/\S+$/i.test(url.trim()) ? url.trim() : "";
  const [failedUrl, setFailedUrl] = useState("");
  if (!source || failedUrl === source) return null;
  return (
    <img
      src={source}
      alt={alt}
      className="max-h-64 w-full rounded-lg object-cover"
      onError={() => setFailedUrl(source)}
    />
  );
}

function articleCopy(article: Article, locale: "en" | "ar"): ArticleContent {
  const primary = article[locale];
  const other = article[locale === "en" ? "ar" : "en"];
  return {
    title: primary.title || other.title,
    slug: primary.slug || other.slug,
    excerpt: primary.excerpt || other.excerpt,
    content: primary.content || other.content,
    seoTitle: primary.seoTitle || other.seoTitle,
    metaDescription: primary.metaDescription || other.metaDescription,
  };
}

function ArticleView({
  article,
  category,
  language,
  onLanguage,
  onClose,
}: {
  article: Article;
  category: string;
  language: "en" | "ar";
  onLanguage: (language: "en" | "ar") => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const copy = article[language];
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="break-words">{copy.title || articleCopy(article, language).title || t("common.view")}</DialogTitle>
        </DialogHeader>
        <ArticleImage url={article.featuredImageUrl ?? ""} alt={copy.title || articleCopy(article, language).title || t("articles.imageUrl")} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={language === "en" ? "default" : "outline"} onClick={() => onLanguage("en")}>{t("articles.english")}</Button>
          <Button type="button" size="sm" variant={language === "ar" ? "default" : "outline"} onClick={() => onLanguage("ar")}>{t("articles.arabic")}</Button>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="min-w-0"><dt className="text-muted-foreground">{t("fields.category")}</dt><dd className="mt-1 break-words">{category}</dd></div>
          <div><dt className="text-muted-foreground">{t("fields.status")}</dt><dd className="mt-1"><StatusBadge value={article.status} /></dd></div>
          <div><dt className="text-muted-foreground">{t("fields.publishDate")}</dt><dd className="mt-1"><DateText value={article.publishDate} /></dd></div>
        </dl>
        {copy.excerpt ? <p className="text-sm break-words text-muted-foreground">{copy.excerpt}</p> : null}
        {copy.content ? (
          <article dir={language === "ar" ? "rtl" : "ltr"} className="max-w-none text-sm leading-6 break-words" dangerouslySetInnerHTML={{ __html: copy.content }} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t("common.close")}</Button>
          <Button type="button" render={<Link href={`/website/articles/${article.id}`} />}>{t("common.edit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RichText({ initial, dir, onChange }: { initial: string; dir: "ltr" | "rtl"; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const initialHtml = useRef(initial);
  onChangeRef.current = onChange;

  const assign = useCallback((node: HTMLDivElement | null) => {
    ref.current = node;
    if (node && node.dataset.ready !== "1") {
      node.innerHTML = initialHtml.current;
      node.dataset.ready = "1";
    }
  }, []);

  function emit() {
    onChangeRef.current(ref.current?.innerHTML ?? "");
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        <Tool label="B" command="bold" onApplied={emit} />
        <Tool label="I" command="italic" onApplied={emit} />
        <Tool label="H2" command="formatBlock" value="H2" onApplied={emit} />
        <Tool label="•" command="insertUnorderedList" onApplied={emit} />
        <Tool label="1." command="insertOrderedList" onApplied={emit} />
        <Button type="button" size="sm" variant="outline" onMouseDown={(event) => {
          event.preventDefault();
          const url = window.prompt("https://");
          if (url) document.execCommand("createLink", false, url);
          emit();
        }}>Link</Button>
      </div>
      <div
        ref={assign}
        contentEditable
        dir={dir}
        role="textbox"
        aria-multiline="true"
        className="min-h-40 rounded-lg border border-input px-3 py-2 text-sm outline-none focus-visible:border-ring"
        onInput={emit}
      />
    </div>
  );
}

function Tool({ label, command, value, onApplied }: { label: string; command: string; value?: string; onApplied: () => void }) {
  return <Button type="button" size="sm" variant="outline" onMouseDown={(event) => { event.preventDefault(); document.execCommand(command, false, value); onApplied(); }}>{label}</Button>;
}

function blank() {
  return { title: "", slug: "", excerpt: "", content: "", seoTitle: "", metaDescription: "" };
}
