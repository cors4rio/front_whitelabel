import { AppShell } from "@/components/shell/app-shell";

export default function LayoutAutenticado({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
