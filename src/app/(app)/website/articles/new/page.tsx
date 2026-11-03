import { Suspense } from "react";
import { ArticleEditor } from "@/components/articles/article-editor";
import { listCategories } from "@/server/services/content";

export default function NewArticlePage() {
  return (
    <Suspense fallback={null}>
      <NewArticleContent />
    </Suspense>
  );
}

async function NewArticleContent() {
  const categories = await listCategories("article");
  return <ArticleEditor article={null} categories={categories} />;
}
