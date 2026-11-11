import { AppFrame } from "@/components/app-frame";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
