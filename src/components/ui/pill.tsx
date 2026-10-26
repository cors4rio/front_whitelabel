type Tom = "ok" | "atencao" | "problema" | "neutro";

const TONS: Record<Tom, string> = {
  ok: "border-moss/60 text-moss",
  atencao: "border-amber/70 text-amber-ink",
  problema: "border-crimson/60 text-crimson",
  neutro: "border-line text-muted",
};

/** Estado = forma + texto (borda + rótulo), nunca só uma bolinha colorida. */
export function Pill({ tom = "neutro", children }: { tom?: Tom; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONS[tom]}`}
    >
      {children}
    </span>
  );
}
