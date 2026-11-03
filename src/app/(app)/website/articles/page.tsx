import { Suspense } from "react";
import { ArticlesScreen } from "@/components/articles/article-editor";
import { listArticles, listCategories } from "@/server/services/content";

export default function ArticlesPage() {
  return (
    <Suspense fallback={null}>
      <ArticlesContent />
    </Suspense>
  );
}

async function ArticlesContent() {
  const [articles, categories] = await Promise.all([listArticles(), listCategories("article")]);
  return <ArticlesScreen articles={articles} categories={categories} />;
}
