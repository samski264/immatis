"use client";

// Le bandeau final renvoie au dépôt et ouvre le sélecteur, dans le même geste.
export default function DepositButton({ className, inputId, children }) {
  return (
    <a
      className={className}
      href="#depot"
      onClick={() => {
        document.getElementById(inputId)?.click();
      }}
    >
      {children}
    </a>
  );
}
