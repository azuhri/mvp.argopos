import { useEffect, useRef, useState } from "react";
import { voucherService } from "@/lib/services/voucherService";
import type { VoucherCartLine, VoucherQuote } from "@/lib/voucherTypes";

export function useVoucherQuote(locationId: string, carts: VoucherCartLine[], total: number, enabled = true) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ key: string; data: VoucherQuote }>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const version = useRef(0);
  const cartKey = JSON.stringify(carts);
  const key = JSON.stringify([locationId, cartKey, total, code, enabled]);
  const currentKey = useRef(key);
  currentKey.current = key;
  const quote = result?.key === key ? result.data : undefined;
  useEffect(() => {
    version.current += 1;
    setPending(false);
    setError("");
  }, [locationId, cartKey, total, enabled]);
  useEffect(() => () => { version.current += 1; }, []);
  const changeCode = (value: string) => {
    version.current += 1;
    setCode(value.toUpperCase().slice(0, 20)); setResult(undefined); setError(""); setPending(false);
  };
  const apply = async () => {
    if (!enabled || !locationId || pending) return;
    if (!/^[A-Z0-9_-]{1,20}$/.test(code.trim())) { setError("Masukkan kode voucher yang valid (maksimal 20 karakter)."); return; }
    const requestVersion = ++version.current;
    setPending(true); setError("");
    try {
      const data = await voucherService.quote(locationId, code.trim(), carts);
      if (requestVersion !== version.current || currentKey.current !== key) return;
      setResult({ key, data });
    } catch (cause) {
      if (requestVersion !== version.current || currentKey.current !== key) return;
      setResult(undefined); setError(cause instanceof Error ? cause.message : "Voucher belum dapat diperiksa.");
    } finally {
      if (requestVersion === version.current) setPending(false);
    }
  };
  const valid = Boolean(enabled && quote && (!quote.expires_at || Date.parse(quote.expires_at) > Date.now()));
  return { code, changeCode, quote: valid ? quote : undefined, pending, error, apply, needsValidation: Boolean(code.trim()) && !valid };
}
