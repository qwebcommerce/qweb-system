import { ArticlesScreen } from "@/components/articles/article-editor";
import { listArticles, listCategories } from "@/server/services/content";

export default async function ArticlesPage() {
  const [articles, categories] = await Promise.all([listArticles(), listCategories("article")]);
  return <ArticlesScreen articles={articles} categories={categories} />;
}
