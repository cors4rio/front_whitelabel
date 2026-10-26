import { Inter, Sora } from "next/font/google";

const display = Sora({ variable: "--font-marca-display", subsets: ["latin"], weight: ["600", "700"] });
const texto = Inter({ variable: "--font-marca-texto", subsets: ["latin"], weight: ["400", "500", "600"] });

export const fontesDaMarca = `${display.variable} ${texto.variable}`;
