import { notFound } from "next/navigation";
import ArticleView from "@/components/ArticleView";
import { articleParams, getArticle } from "@/lib/articles";

export const dynamicParams = false;

export function generateStaticParams() {
  return articleParams();
}

export async function generateMetadata({ params }) {
  const { silo, rest } = await params;
  const article = getArticle(silo, rest);
  if (!article) return {};
  return {
    title: `${article.title} — Immatis`,
    description: article.description,
  };
}

export default async function ArticlePage({ params }) {
  const { silo, rest } = await params;
  const article = getArticle(silo, rest);
  if (!article) notFound();
  return <ArticleView article={article} />;
}
