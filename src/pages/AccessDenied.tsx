import { ShieldX } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function AccessDenied() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full glass-card p-8 text-center">
        <div className="h-14 w-14 rounded-full bg-destructive/10 mx-auto mb-4 flex items-center justify-center">
          <ShieldX className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Kamu tidak memiliki izin untuk mengakses halaman ini.
        </p>
        <Button asChild className="w-full">
          <Link to="/">Kembali ke Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
