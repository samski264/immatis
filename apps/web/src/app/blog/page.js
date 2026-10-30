import BlogIndex from "@/components/blog/BlogIndex";
import { INDEX } from "@/lib/blog";

export const metadata = {
  title: { absolute: "Blog — Immatis" },
  description:
    "Vos questions avant d'acheter, répondues champ par champ. Chaque article part d'un champ du certificat d'immatriculation et finit sur la règle appliquée.",
};

export default function BlogPage() {
  return <BlogIndex cards={INDEX} />;
}
