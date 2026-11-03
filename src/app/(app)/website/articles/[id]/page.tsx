import { notFound } from "next/navigation";
import { ArticleEditor } from "@/components/articles/article-editor";
import { getArticle, listCategories } from "@/server/services/content";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [article, categories] = await Promise.all([getArticle(id), listCategories("article")]);
  if (!article) notFound();
  return <ArticleEditor key={article.updatedAt} article={article} categories={categories} />;
}
