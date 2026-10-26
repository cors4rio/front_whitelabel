import type { Metadata } from "next";
import { Suspense } from "react";

import { FormLogin } from "./form-login";

export const metadata: Metadata = { title: "Entrar" };

export default function PaginaLogin() {
  return (
    <Suspense>
      <FormLogin />
    </Suspense>
  );
}
