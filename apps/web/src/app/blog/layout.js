import { BlogFooter, BlogNav } from "@/components/blog/BlogChrome";
import styles from "./blog.module.css";

export const metadata = {
  title: {
    default: "Blog",
    template: "%s — Immatis",
  },
  description:
    "Trois dossiers, un par réponse que l'administration donnera à votre dossier. Chaque article part d'un champ du certificat et finit sur la règle appliquée.",
};

export default function BlogLayout({ children }) {
  return (
    <div className={styles.shell}>
      <div className={styles.page}>
        <BlogNav />
        {children}
        <BlogFooter />
      </div>
    </div>
  );
}
