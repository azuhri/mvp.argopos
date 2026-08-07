import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShoppingBag,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { RoleName, useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { config } from "@/lib/config";

const roleRedirectMap: Record<RoleName, string> = {
  super_admin: "/dashboard",
  admin: "/dashboard",
  staff_internal: "/dashboard",
  sales_external: "/store",
};

const getRoleRedirect = (role?: string) =>
  roleRedirectMap[role as RoleName] ?? "/dashboard";

const productVisuals = [
  "image/BAKSO SAPI PACKSHOT.png",
  "image/SOSIS COCKTAIL PACKSHOT.png",
  "image/NUGGET PACKSHOT.PNG",
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { login, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const errors = useMemo(() => {
    const next = { email: "", password: "" };
    if (!email.trim()) next.email = "Email wajib diisi";
    if (!password.trim()) next.password = "Password wajib diisi";
    return next;
  }, [email, password]);

  useEffect(() => {
    if (user) {
      const targetPath = location.state?.from;
      navigate(
        targetPath && targetPath !== "/auth/sign-in" ? targetPath : getRoleRedirect(user.role),
        { replace: true },
      );
    }
  }, [location.state?.from, navigate, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ email: true, password: true });

    if (errors.email || errors.password) return;

    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      if (!result.ok) {
        throw new Error(result.message || "Login gagal");
      }

      toast.success("Login berhasil");

      const targetPath = location.state?.from;
      if (targetPath && targetPath !== "/auth/sign-in") {
        navigate(targetPath, { replace: true });
        return;
      }

      navigate(getRoleRedirect(result.data?.user?.role?.role_name), { replace: true });
    } catch (error) {
      toast.error((error as Error).message || "Login gagal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="admin-theme min-h-screen bg-background p-3 sm:p-5 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-6xl overflow-hidden rounded-lg border border-border bg-card shadow-[0_24px_70px_rgba(20,55,42,0.12)] sm:min-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-[#153b2f] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#185c45]">
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-semibold">{config.appName}</p>
              <p className="text-xs text-white/65">Celestia commerce workspace</p>
            </div>
          </div>

          <div className="relative z-10 max-w-lg py-10">
            <p className="mb-4 text-sm font-medium text-emerald-200">Workspace operasional</p>
            <h1 className="max-w-md text-4xl font-semibold leading-tight xl:text-5xl">
              Kelola commerce dengan tampilan yang lebih jernih.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/70">
              Pantau transaksi, pelanggan, produk, dan persediaan dari satu ruang kerja.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3" aria-hidden="true">
            {productVisuals.map((src, index) => (
              <div
                key={src}
                className="h-36 overflow-hidden rounded-lg border border-white/15 bg-white p-2 xl:h-44"
              >
                <img
                  src={`${import.meta.env.BASE_URL}${src}`}
                  alt=""
                  className="h-full w-full object-contain"
                  loading={index === 0 ? "eager" : "lazy"}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-8 sm:px-10 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="w-full max-w-sm"
          >
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{config.appName}</p>
                <p className="text-xs text-muted-foreground">Celestia commerce workspace</p>
              </div>
            </div>

            <div className="mb-8">
              <p className="text-sm font-medium text-primary">Admin portal</p>
              <h2 className="mt-2 text-3xl font-semibold text-foreground">Selamat datang kembali</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Masuk menggunakan akun yang telah terdaftar.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onBlur={() => setTouched((previous) => ({ ...previous, email: true }))}
                    placeholder="nama@perusahaan.com"
                    className="h-11 rounded-lg bg-background pl-10"
                    aria-invalid={Boolean(touched.email && errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    autoFocus
                  />
                </div>
                {touched.email && errors.email ? (
                  <p id="email-error" className="text-xs text-destructive" role="alert">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onBlur={() => setTouched((previous) => ({ ...previous, password: true }))}
                    placeholder="Masukkan password"
                    className="h-11 rounded-lg bg-background pl-10 pr-11"
                    aria-invalid={Boolean(touched.password && errors.password)}
                    aria-describedby={errors.password ? "password-error" : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {touched.password && errors.password ? (
                  <p id="password-error" className="text-xs text-destructive" role="alert">
                    {errors.password}
                  </p>
                ) : null}
              </div>

              <Button type="submit" className="h-11 w-full rounded-lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Memproses...
                  </>
                ) : (
                  "Masuk"
                )}
              </Button>
            </form>

            <div className="mt-8 border-t border-border pt-6">
              <Link
                to="/commerce"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Buka katalog pelanggan
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
