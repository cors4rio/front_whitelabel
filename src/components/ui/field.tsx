"use client";

import { useId } from "react";

const CONTROLE_BASE =
  "w-full rounded-ui border bg-paper px-3 text-sm text-fg placeholder:text-muted disabled:opacity-60 " +
  "aria-[invalid=true]:border-crimson";
const CONTROLE = `h-10 ${CONTROLE_BASE}`;

interface FieldProps {
  rotulo: string;
  erro?: string;
  dica?: string;
  className?: string;
  /** Recebe os atributos de acessibilidade que o controle precisa (id, aria-invalid, aria-describedby). */
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode;
}

/** Rótulo + controle + dica/erro ligados por aria; o erro aparece em texto, nunca só em cor. */
export function Field({ rotulo, erro, dica, className = "", children }: FieldProps) {
  const id = useId();
  const idMensagem = `${id}-msg`;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-medium">
        {rotulo}
      </label>
      {children({ id, "aria-invalid": erro ? true : undefined, "aria-describedby": erro || dica ? idMensagem : undefined })}
      {(erro || dica) && (
        <p id={idMensagem} className={`text-[13px] ${erro ? "text-crimson" : "text-muted"}`}>
          {erro ?? dica}
        </p>
      )}
    </div>
  );
}

export function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROLE} border-line ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${CONTROLE} border-line ${className}`} {...props}>
      {children}
    </select>
  );
}

/** Texto em várias linhas. Cresce para baixo se a pessoa puxar a alça; a altura mínima mostra umas quatro linhas. */
export function Textarea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${CONTROLE_BASE} min-h-24 resize-y border-line py-2 ${className}`} {...props} />;
}
