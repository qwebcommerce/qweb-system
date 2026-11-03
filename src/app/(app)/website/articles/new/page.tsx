import { ArticleEditor } from "@/components/articles/article-editor";
import { listCategories } from "@/server/services/content";

export default async function NewArticlePage() {
  const categories = await listCategories("article");
  return <ArticleEditor article={null} categories={categories} />;
}
