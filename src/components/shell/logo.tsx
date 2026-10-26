import { marca } from "@/lib/config";

/**
 * Logotipo da marca da instalação; sem logo cadastrado, mostra o nome em texto (com `className` de tipografia).
 * `fundo`: "escuro" (menu lateral), "claro" ou "tema" (login e topo do celular: segue o tema da página).
 */
export function Logo({ fundo, className = "" }: { fundo: "claro" | "escuro" | "tema"; className?: string }) {
  const logo = marca.logo;
  if (!logo) return <span className={className}>{marca.nome}</span>;

  const imagem = (src: string, extra = "") => (
    // SVG/PNG estático da própria marca: o otimizador do next/image não agrega nada.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={marca.nome} height={logo.altura} style={{ height: logo.altura, width: "auto" }} className={extra} />
  );

  if (fundo === "escuro") return imagem(logo.sobreEscuro);
  if (fundo === "claro") return imagem(logo.sobreClaro);
  return (
    <>
      {imagem(logo.sobreClaro, "logo-tema-claro")}
      {imagem(logo.sobreEscuro, "logo-tema-escuro")}
    </>
  );
}
