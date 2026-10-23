import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Package,
  ShoppingBag,
  Users,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { RoleName, useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const roleRedirectMap: Record<RoleName, string> = {
  super_admin: "/dashboard",
  admin: "/dashboard",
  staff_internal: "/dashboard",
  sales_external: "/store",
};

const getRoleRedirect = (role?: string) =>
  roleRedirectMap[role as RoleName] ?? "/dashboard";

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;
const brandAsset = assetUrl("image/amp-mart-icon.png");

const productVisuals = [
  {
    src: "image/BAKSO SAPI PACKSHOT.png",
    className:
      "bottom-[6.9rem] left-[7%] z-10 h-[13.5rem] w-auto -rotate-[2deg] 2xl:h-[15.5rem]",
    clipPath: "polygon(20% 8%, 80% 8%, 88% 96%, 12% 96%)",
  },
  {
    src: "image/SOSIS COCKTAIL PACKSHOT.png",
    className:
      "bottom-[6.6rem] left-1/2 z-20 h-[17.5rem] w-auto -translate-x-1/2 2xl:h-[20rem]",
    clipPath: "polygon(10% 5%, 90% 5%, 96% 96%, 4% 96%)",
  },
  {
    src: "image/NUGGET PACKSHOT.PNG",
    className:
      "bottom-[6.9rem] right-[7%] z-10 h-[13.5rem] w-auto rotate-[2deg] 2xl:h-[15.5rem]",
    clipPath: "polygon(10% 5%, 90% 5%, 96% 96%, 4% 96%)",
  },
];

const workspaceFeatures = [
  { label: "Kelola produk", icon: Package },
  { label: "Pantau pesanan", icon: ClipboardList },
  { label: "Layanan pelanggan", icon: Users },
  { label: "Data persediaan", icon: BarChart3 },
];

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={
        compact
          ? "relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
          : "relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.16)]"
      }
      aria-hidden="true"
    >
      <img
        src={brandAsset}
        alt=""
        className={
          compact
            ? "absolute left-[-26px] top-[-12px] h-[99px] w-[99px] max-w-none"
            : "absolute left-[-34px] top-[-16px] h-[127px] w-[127px] max-w-none"
        }
      />
    </span>
  );
}

function CircuitBackdrop() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 800 1000"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="circuit-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0ea5e9" stopOpacity="0.12" />
          <stop offset="0.55" stopColor="#168bff" stopOpacity="0.58" />
          <stop offset="1" stopColor="#38bdf8" stopOpacity="0.12" />
        </linearGradient>
        <filter id="circuit-glow" x="-250%" y="-250%" width="600%" height="600%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g fill="none" stroke="url(#circuit-stroke)" strokeWidth="1">
        <path d="M610 0l190 190" />
        <path d="M660 0l140 140" />
        <path d="M725 0l75 75" />
        <path d="M800 270l-150 150v86" />
        <path d="M800 320L678 442v74" />
        <path d="M800 376L704 472v98" />
        <path d="M0 470l74 74v112" />
        <path d="M0 520l42 42v166" />
        <path d="M0 680l82 82h138" />
        <path d="M592 50l138 138v72l-70 70" />
        <path d="M720 50v142" />
      </g>

      <g fill="#7dd3fc" filter="url(#circuit-glow)">
        <circle cx="650" cy="420" r="2.5" />
        <circle cx="678" cy="516" r="2" />
        <circle cx="704" cy="570" r="2" />
        <circle cx="74" cy="544" r="2.5" />
        <circle cx="82" cy="762" r="2" />
        <circle cx="730" cy="188" r="2" />
      </g>
    </svg>
  );
}

function WorkspaceVisual() {
  return (
    <div className="relative mt-3 min-h-[22rem] flex-1 2xl:min-h-[25rem]">
      <div
        className="absolute bottom-[4.55rem] left-1/2 z-0 h-20 w-[96%] -translate-x-1/2 rounded-b-[45%] bg-gradient-to-b from-[#e7edf7] via-[#d6e0ee] to-[#aebfd6] shadow-[0_28px_55px_rgba(0,0,0,0.3)]"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[7.25rem] left-1/2 z-[1] h-16 w-[96%] -translate-x-1/2 rounded-[50%] border border-white/75 bg-gradient-to-b from-white to-[#dfe7f3]"
        aria-hidden="true"
      />

      <div className="absolute inset-0" aria-hidden="true">
        {productVisuals.map((product) => (
          <img
            key={product.src}
            src={assetUrl(product.src)}
            alt=""
            className={`absolute object-contain drop-shadow-[0_22px_22px_rgba(0,0,0,0.28)] ${product.className}`}
            style={{ clipPath: product.clipPath }}
            loading="lazy"
            decoding="async"
          />
        ))}
      </div>

      <ul className="absolute inset-x-0 bottom-0 z-30 grid grid-cols-4 overflow-hidden rounded-xl border border-white/70 bg-white px-3 py-4 text-[#071a4f] shadow-[0_18px_50px_rgba(0,15,52,0.32)]">
        {workspaceFeatures.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <li
              key={feature.label}
              className={`flex min-w-0 items-center justify-center gap-2.5 px-2 ${
                index > 0 ? "border-l border-slate-200" : ""
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eff5ff] text-[#1463ff]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="max-w-[6.25rem] text-[11px] font-medium leading-5 2xl:text-xs">
                {feature.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { login, user } = useAuth();
  const reduceMotion = useReducedMotion();

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

  const showEmailError = Boolean(touched.email && errors.email);
  const showPasswordError = Boolean(touched.password && errors.password);

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
    <main className="admin-theme min-h-[100svh] overflow-x-hidden bg-[#f5f8fd] text-foreground">
      <div className="grid min-h-[100svh] xl:grid-cols-[minmax(0,1.08fr)_minmax(35rem,0.92fr)]">
        <section className="relative hidden min-h-[100svh] overflow-hidden bg-[#041947] px-12 pb-10 pt-11 text-white xl:flex xl:flex-col 2xl:px-16 2xl:pb-12 2xl:pt-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_36%,rgba(10,73,148,0.46),transparent_36%),radial-gradient(circle_at_72%_68%,rgba(2,76,161,0.35),transparent_34%),linear-gradient(145deg,#06265d_0%,#03143e_52%,#041d50_100%)]" />
          <CircuitBackdrop />

          <header className="relative z-10 flex items-center gap-6">
            <div className="flex items-center gap-3" aria-label="AMP Mart, Argo Manunggal Proteindo">
              <BrandMark />
              <div className="leading-none">
                <p className="text-[1.45rem] font-extrabold tracking-tight">
                  AMP <span className="text-[#ff2332]">Mart</span>
                </p>
                <p className="mt-1.5 text-[10px] font-semibold tracking-wide text-white/75">
                  Argo Manunggal Proteindo
                </p>
              </div>
            </div>

            <span className="h-10 w-px bg-white/35" aria-hidden="true" />

            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#071a4f] shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
                <ShoppingBag className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-base font-bold tracking-wide">CELESTORE</p>
                <p className="mt-0.5 text-xs text-white/65">Commerce workspace</p>
              </div>
            </div>
          </header>

          <div className="relative z-10 mt-[clamp(3.5rem,7vh,5.25rem)] max-w-[39rem]">
            <p className="inline-flex rounded-full border-2 border-[#f20b24] px-5 py-2 text-xs font-bold uppercase tracking-[0.13em] text-white">
              Workspace operasional
            </p>
            <p className="mt-5 max-w-[38rem] text-[clamp(2.7rem,3.55vw,3.65rem)] font-extrabold leading-[1.08] tracking-[-0.035em] text-balance">
              Kelola operasional commerce dalam satu ruang kerja.
            </p>
            <p className="mt-5 max-w-[35rem] text-base leading-7 text-white/78">
              Pantau pesanan, produk, pelanggan, dan persediaan dengan lebih cepat dan akurat.
            </p>
          </div>

          <WorkspaceVisual />
        </section>

        <section className="relative flex min-h-[100svh] flex-col overflow-hidden px-4 py-5 sm:px-8 sm:py-8 xl:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_8%,rgba(214,226,244,0.7),transparent_27%),radial-gradient(circle_at_16%_86%,rgba(225,234,247,0.72),transparent_30%)]" />

          <div className="relative z-10 flex w-full flex-1 items-center justify-center">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
              className="w-full max-w-[35.5rem] rounded-2xl border border-[#d9e3f2] bg-white px-6 py-8 shadow-[0_24px_70px_rgba(24,55,98,0.10)] sm:px-10 sm:py-10 xl:px-10 xl:py-11"
            >
              <div className="mb-8 flex items-center gap-3 xl:hidden">
                <BrandMark compact />
                <div className="min-w-0">
                  <p className="truncate text-base font-extrabold tracking-tight text-[#071a4f]">
                    AMP <span className="text-[#e30613]">Mart</span>
                  </p>
                  <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">
                    CELESTORE · Commerce workspace
                  </p>
                </div>
              </div>

              <div className="mb-8">
                <p className="text-xs font-extrabold uppercase tracking-[0.11em] text-[#071a4f]">
                  Admin portal
                </p>
                <h1 className="mt-4 text-[2rem] font-extrabold leading-tight tracking-[-0.035em] text-[#071a4f] sm:text-[2.25rem]">
                  Selamat datang kembali
                </h1>
                <p className="mt-2 max-w-[29rem] text-sm leading-6 text-muted-foreground sm:text-[15px]">
                  Masuk untuk mengelola katalog, pesanan, pelanggan, dan persediaan.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-busy={submitting}>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-semibold text-[#071a4f]">
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#53698f]"
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
                      className="h-14 rounded-xl border-[#cbd7eb] bg-white pl-12 pr-4 text-[15px] shadow-none placeholder:text-slate-400 focus-visible:border-[#071a4f] focus-visible:ring-[#071a4f]/20"
                      aria-invalid={showEmailError}
                      aria-describedby={showEmailError ? "email-error" : undefined}
                      autoFocus
                    />
                  </div>
                  {showEmailError ? (
                    <p id="email-error" className="text-xs font-medium text-destructive" role="alert">
                      {errors.email}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-semibold text-[#071a4f]">
                    Password
                  </label>
                  <div className="relative">
                    <LockKeyhole
                      className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#53698f]"
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
                      className="h-14 rounded-xl border-[#cbd7eb] bg-white pl-12 pr-12 text-[15px] shadow-none placeholder:text-slate-400 focus-visible:border-[#071a4f] focus-visible:ring-[#071a4f]/20"
                      aria-invalid={showPasswordError}
                      aria-describedby={showPasswordError ? "password-error" : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#53698f] transition-colors hover:bg-slate-100 hover:text-[#071a4f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#071a4f] focus-visible:ring-offset-2"
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {showPasswordError ? (
                    <p id="password-error" className="text-xs font-medium text-destructive" role="alert">
                      {errors.password}
                    </p>
                  ) : null}
                </div>

                <Button
                  type="submit"
                  className="admin-accent-button h-14 w-full rounded-xl text-base font-bold shadow-[0_12px_28px_rgba(227,6,19,0.18)] transition-[background-color,box-shadow,transform] hover:shadow-[0_14px_32px_rgba(227,6,19,0.25)] active:translate-y-px"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <span>Masuk</span>
                      <ArrowRight className="h-5 w-5" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-8 border-t border-[#dbe4f1] pt-7">
                <Button
                  asChild
                  variant="outline"
                  className="h-14 w-full rounded-xl border-2 border-[#071a4f] bg-white text-sm font-bold text-[#071a4f] hover:bg-[#f2f6fd] hover:text-[#071a4f] sm:text-[15px]"
                >
                  <Link to="/commerce">
                    <span>Buka katalog pelanggan</span>
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>

              <p className="mt-8 flex items-center gap-2.5 text-xs font-medium text-muted-foreground sm:text-sm">
                <LockKeyhole className="h-4 w-4 shrink-0 text-[#53698f]" aria-hidden="true" />
                Akses aman untuk tim internal.
              </p>
            </motion.div>
          </div>

          <footer className="relative z-10 mt-5 text-center text-[11px] font-medium text-[#60759b] sm:text-xs">
            © {new Date().getFullYear()} Argo Manunggal Group. All rights reserved.
          </footer>
        </section>
      </div>
    </main>
  );
}
