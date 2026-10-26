import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";

// Cada marca declara as próprias fontes (o next/font exige chamadas literais, por isso fica num módulo da marca).
// O contrato com o resto do sistema: `fontesDaMarca` é o className que define --font-marca-display e --font-marca-texto.
const display = Bricolage_Grotesque({ variable: "--font-marca-display", subsets: ["latin"], weight: ["600", "700"] });
const texto = Plus_Jakarta_Sans({ variable: "--font-marca-texto", subsets: ["latin"], weight: ["400", "500", "600"] });

export const fontesDaMarca = `${display.variable} ${texto.variable}`;
