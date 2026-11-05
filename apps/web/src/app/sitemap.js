import { articleIndex } from "@/lib/articles";
import { blogIndex } from "@/lib/blog";
import { SITE } from "@/lib/site";

function entry(path, { updated, changeFrequency, priority }) {
  return {
    url: path === "/" ? `${SITE}/` : `${SITE}${path}`,
    ...(updated ? { lastModified: updated } : {}),
    changeFrequency,
    priority,
  };
}

export default function sitemap() {
  const pages = [
    entry("/", { changeFrequency: "weekly", priority: 1 }),
    entry("/blog", { changeFrequency: "weekly", priority: 0.7 }),
  ];

  const silos = articleIndex().map(({ path, updated }) => {
    const depth = path.split("/").filter(Boolean).length;
    return entry(path, {
      updated,
      changeFrequency: "monthly",
      priority: depth === 1 ? 0.8 : 0.6,
    });
  });

  const blog = blogIndex().map(({ path, updated }) =>
    entry(path, {
      updated,
      changeFrequency: "monthly",
      priority: updated ? 0.5 : 0.6,
    }),
  );

  return [...pages, ...silos, ...blog];
}
