import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleEditor } from "@/components/articles/article-editor";
import { getArticle, listCategories } from "@/server/services/content";

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <ArticleContent params={params} />
    </Suspense>
  );
}

async function ArticleContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [article, categories] = await Promise.all([getArticle(id), listCategories("article")]);
  if (!article) notFound();
  return <ArticleEditor key={article.updatedAt} article={article} categories={categories} />;
}
