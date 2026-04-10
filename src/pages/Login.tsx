import { FormEvent, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, Mail, Phone, Snowflake } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const roleRedirectMap = {
  super_admin: "/dashboard",
  staff_internal: "/transactions",
  sales_external: "/store",
} as const;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { login, user } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<{ identifier: boolean; password: boolean }>({
    identifier: false,
    password: false,
  });

  const errors = useMemo(() => {
    const next = { identifier: "", password: "" };
    if (!identifier.trim()) next.identifier = "Email/phone wajib diisi";
    if (!password.trim()) next.password = "Password wajib diisi";
    if (password.trim() && password.length < 6) next.password = "Minimal 6 karakter";
    return next;
  }, [identifier, password]);

  if (user) {
    navigate(roleRedirectMap[user.role], { replace: true });
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ identifier: true, password: true });

    if (errors.identifier || errors.password) return;

    setSubmitting(true);
    const result = await login(identifier.trim(), password);
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message || "Login gagal");
      return;
    }

    toast.success("Login berhasil");

    const targetPath = location.state?.from;
    if (targetPath && targetPath !== "/auth/sign-in") {
      navigate(targetPath, { replace: true });
      return;
    }

    const safeIdentifier = identifier.trim();
    const role = safeIdentifier === "admin@argopos.id"
      ? "super_admin"
      : safeIdentifier === "staff@argopos.id"
      ? "staff_internal"
      : "sales_external";

    navigate(roleRedirectMap[role], { replace: true });
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.2),transparent_40%),radial-gradient(circle_at_bottom_right,hsl(var(--accent-foreground)/0.12),transparent_45%)]" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md glass-card p-6 sm:p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
            <Snowflake className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">ArgoPOS</h1>
            <p className="text-xs text-muted-foreground">CMS + CRM + POS + E-commerce</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email / Phone</label>
            <div className="relative">
              {identifier.includes("@") ? (
                <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              ) : (
                <Phone className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              )}
              <Input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, identifier: true }))}
                placeholder="admin@argopos.id / 081111111111"
                className="pl-9 h-11 bg-card/70"
              />
            </div>
            {touched.identifier && errors.identifier ? (
              <p className="text-xs text-destructive">{errors.identifier}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Password</label>
            <div className="relative">
              <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                placeholder="******"
                className="pl-9 pr-10 h-11 bg-card/70"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {touched.password && errors.password ? (
              <p className="text-xs text-destructive">{errors.password}</p>
            ) : null}
          </div>

          <Button type="submit" className="w-full h-11" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masuk"}
          </Button>
        </form>

        <div className="mt-5 text-xs text-muted-foreground space-y-1">
          <p>Demo account:</p>
          <p>- admin@argopos.id / admin123</p>
          <p>- staff@argopos.id / staff123</p>
          <p>- sales@mitra.id / sales123</p>
        </div>
      </motion.div>
    </div>
  );
}
