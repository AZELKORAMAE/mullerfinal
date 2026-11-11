import Link from "next/link";
import { Building2 } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand">
      <Building2 aria-hidden="true" />
      SyndiConnect<span style={{ color: "#2563eb" }}>.</span>
    </Link>
  );
}
