import type { Metadata } from "next";
import { fontesDaMarca } from "@brand/fonts";
import { Oswald } from "next/font/google";

import { Providers } from "@/components/providers";
import { APP_NAME, marca } from "@/lib/config";
import { temaCss } from "@/lib/marca/tema";

import "./globals.css";

// Só para a assinatura "Desenvolvido por AUTTOPUS" (marca da empresa desenvolvedora, não do produto): fixa em toda
// instalação, qualquer que seja a marca (BRAND).
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["600"],
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: marca.descricao,
  ...(marca.favicon ? { icons: { icon: marca.favicon } } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fontesDaMarca} ${oswald.variable} h-full`}>
      <head>
        {/* Cores e raio da marca (conteúdo vem do código da marca, em tempo de build; não é entrada de usuário). */}
        <style dangerouslySetInnerHTML={{ __html: temaCss(marca) }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
