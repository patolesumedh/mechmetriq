"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  BANKS,
  OTHER_BANKS,
  PAY_METHOD_LABEL,
  TEST_CREDENTIALS,
  VPA_RE,
  WALLETS,
  cardBrand,
  digitsOnly,
  expiryValid,
  formatCardNumber,
  formatExpiry,
  isDeclinedTestCard,
  luhnValid,
  newPaymentRef,
  type PayMethod,
} from "@/lib/payments/testGateway";

/**
 * MECHmetriQ Pay — TEST MODE checkout.
 *
 * Looks and behaves like a hosted payment gateway (method picker, UPI
 * collect/QR, card + bank OTP, netbanking/wallet redirect, processing,
 * receipt) but no money moves. Only when the simulated payment succeeds is
 * `authorize` called, which records the purchase on the server.
 */

export type AuthorizeResult =
  | { ok: true; orderId: string; paymentRef: string; paidAt: string }
  | { ok: false; error: string };

type Step =
  | "home"
  | "upi"
  | "upi_qr"
  | "upi_wait"
  | "card"
  | "otp"
  | "netbanking"
  | "wallet"
  | "bank"
  | "processing"
  | "success"
  | "failed";

interface Props {
  amount: number;
  description: string;
  reference: string;
  contact: { email: string; phone: string | null };
  authorize: (method: PayMethod) => Promise<AuthorizeResult>;
  onClose: () => void;
  onDone: (orderId: string) => void;
}

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function TestPaymentGateway({
  amount,
  description,
  reference,
  contact,
  authorize,
  onClose,
  onDone,
}: Props) {
  const [step, setStep] = useState<Step>("home");
  const [history, setHistory] = useState<Step[]>([]);
  const [confirmClose, setConfirmClose] = useState(false);

  // method details
  const [vpa, setVpa] = useState("");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [bank, setBank] = useState<string>("");
  const [wallet, setWallet] = useState<string>("");

  // outcome
  const [method, setMethod] = useState<PayMethod>("upi");
  const [methodDetail, setMethodDetail] = useState("");
  const [processingText, setProcessingText] = useState("");
  const [result, setResult] = useState<{
    paymentRef: string;
    orderId?: string;
    paidAt: string;
    reason?: string;
  } | null>(null);

  const busy = step === "processing";
  const finished = step === "success";

  const go = (next: Step) => {
    setHistory((h) => [...h, step]);
    setStep(next);
  };
  const back = () => {
    setStep(history[history.length - 1] ?? "home");
    setHistory((h) => h.slice(0, -1));
  };
  const restart = () => {
    setHistory([]);
    setStep("home");
    setOtp("");
    setOtpError("");
    setOtpAttempts(0);
    setResult(null);
  };

  const requestClose = () => {
    if (busy) return;
    if (finished && result?.orderId) return onDone(result.orderId);
    if (step === "home" || step === "failed") return onClose();
    setConfirmClose(true);
  };

  // Lock page scroll + Escape to close
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  const requestCloseRef = useRef(requestClose);
  useEffect(() => {
    requestCloseRef.current = requestClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Runs the processing screen; `simulatedFailure` short-circuits before the server. */
  async function process(m: PayMethod, detail: string, simulatedFailure?: string) {
    setMethod(m);
    setMethodDetail(detail);
    setHistory([]);
    setStep("processing");
    const texts =
      m === "card"
        ? ["Verifying card details…", "Authorising with your bank…", "Confirming your order…"]
        : m === "upi"
          ? ["Checking payment status…", "Payment received, confirming…", "Confirming your order…"]
          : ["Receiving confirmation from bank…", "Verifying transaction…", "Confirming your order…"];
    let i = 0;
    setProcessingText(texts[0]);
    const timer = setInterval(() => {
      i = Math.min(i + 1, texts.length - 1);
      setProcessingText(texts[i]);
    }, 900);

    try {
      if (simulatedFailure) {
        await sleep(2200);
        setResult({ paymentRef: newPaymentRef(), paidAt: new Date().toISOString(), reason: simulatedFailure });
        setStep("failed");
        return;
      }
      const [res] = await Promise.all([
        authorize(m).catch(
          (): AuthorizeResult => ({ ok: false, error: "We couldn't reach the server. Please try again." })
        ),
        sleep(2400),
      ]);
      if (res.ok) {
        setResult({ paymentRef: res.paymentRef, orderId: res.orderId, paidAt: res.paidAt });
        setStep("success");
      } else {
        setResult({ paymentRef: newPaymentRef(), paidAt: new Date().toISOString(), reason: res.error });
        setStep("failed");
      }
    } finally {
      clearInterval(timer);
    }
  }

  // ---- method submitters -------------------------------------------------
  function submitUpi() {
    if (!VPA_RE.test(vpa.trim())) return;
    go("upi_wait");
  }

  function submitCard() {
    const errs: Record<string, string> = {};
    if (!luhnValid(card.number)) errs.number = "Enter a valid card number";
    if (!expiryValid(card.expiry)) errs.expiry = "Invalid expiry";
    const cvvLen = cardBrand(card.number) === "Amex" ? 4 : 3;
    if (digitsOnly(card.cvv).length !== cvvLen) errs.cvv = "Invalid CVV";
    if (card.name.trim().length < 2) errs.name = "Enter the name on card";
    setCardErrors(errs);
    if (Object.keys(errs).length) return;
    const last4 = digitsOnly(card.number).slice(-4);
    if (isDeclinedTestCard(card.number)) {
      void process("card", `${cardBrand(card.number) ?? "Card"} •••• ${last4}`, "Your card was declined by the issuing bank (insufficient funds).");
      return;
    }
    setOtp("");
    setOtpError("");
    setOtpAttempts(0);
    go("otp");
  }

  function submitOtp() {
    if (!/^\d{6}$/.test(otp)) {
      setOtpError("Enter the 6-digit OTP");
      return;
    }
    const last4 = digitsOnly(card.number).slice(-4);
    const detail = `${cardBrand(card.number) ?? "Card"} •••• ${last4}`;
    if (otp === "000000") {
      const attempts = otpAttempts + 1;
      setOtpAttempts(attempts);
      setOtp("");
      if (attempts >= 3) {
        void process("card", detail, "Authentication failed: incorrect OTP entered 3 times.");
      } else {
        setOtpError(`Incorrect OTP. ${3 - attempts} attempt${3 - attempts === 1 ? "" : "s"} left.`);
      }
      return;
    }
    void process("card", detail);
  }

  // ---- render --------------------------------------------------------------
  const title: Record<Step, string> = {
    home: "Payment options",
    upi: "Pay using UPI",
    upi_qr: "Scan QR to pay",
    upi_wait: "Complete payment in your UPI app",
    card: "Add card details",
    otp: "Bank authentication",
    netbanking: "Select your bank",
    wallet: "Select a wallet",
    bank: "",
    processing: "",
    success: "",
    failed: "",
  };

  const selectedBank = BANKS.find((b) => b.code === bank);
  const selectedWallet = WALLETS.find((w) => w.code === wallet);
  const providerName = selectedWallet?.name ?? selectedBank?.name ?? bank;
  const providerColor = selectedWallet?.color ?? selectedBank?.color ?? "#1c5cab";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1526]/60 p-0 backdrop-blur-[2px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="MECHmetriQ Pay checkout"
    >
      <div className="gw-pop relative flex h-full w-full flex-col overflow-hidden bg-surface shadow-2xl sm:h-[600px] sm:max-h-[calc(100vh-2rem)] sm:max-w-[780px] sm:flex-row sm:rounded-2xl">
        {/* ---------------- Left: merchant + amount ---------------- */}
        <aside className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1c5cab] via-[#174e93] to-[#0e3466] px-5 py-4 text-white sm:w-[270px] sm:px-6 sm:py-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/[0.06]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/[0.05]"
          />
          <div className="relative">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-[15px] font-black text-brand-dark">
                M
              </div>
              <div className="leading-tight">
                <div className="text-[14.5px] font-bold">MECHmetriQ</div>
                <div className="flex items-center gap-1 text-[11px] text-white/70">
                  <ShieldIcon className="h-3 w-3" /> Verified merchant
                </div>
              </div>
              <span className="ml-auto rounded-md bg-[#ffcf4a] px-2 py-[3px] text-[10px] font-extrabold tracking-wider text-[#4a3500] sm:hidden">
                TEST MODE
              </span>
            </div>

            <div className="mt-4 sm:mt-8">
              <div className="text-[11.5px] font-medium uppercase tracking-wider text-white/60">
                Amount payable
              </div>
              <div className="mt-1 text-[26px] font-extrabold tracking-tight sm:text-[30px]">{inr(amount)}</div>
              <div className="mt-1 line-clamp-2 text-[12.5px] text-white/75">{description}</div>
              <div className="mt-0.5 font-mono text-[11px] text-white/50">Ref {reference}</div>
            </div>

            <div className="mt-6 hidden space-y-2 border-t border-white/15 pt-4 text-[12px] text-white/80 sm:block">
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <PhoneIcon className="h-3.5 w-3.5 text-white/50" /> {contact.phone}
                </div>
              )}
              <div className="flex items-center gap-2 break-all">
                <MailIcon className="h-3.5 w-3.5 shrink-0 text-white/50" /> {contact.email}
              </div>
            </div>
          </div>

          <div className="relative hidden sm:block">
            <div className="rounded-lg border border-[#ffcf4a]/40 bg-[#ffcf4a]/10 p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="rounded bg-[#ffcf4a] px-1.5 py-[2px] text-[9.5px] font-extrabold tracking-wider text-[#4a3500]">
                  TEST MODE
                </span>
                <span className="text-[11px] font-semibold text-[#ffe08a]">No money is charged</span>
              </div>
              <ul className="space-y-0.5 text-[10.5px] leading-snug text-white/75">
                <li>
                  UPI: <span className="font-mono text-white">{TEST_CREDENTIALS.upiSuccess}</span> ✓ ·{" "}
                  <span className="font-mono text-white">{TEST_CREDENTIALS.upiFailure}</span> ✗
                </li>
                <li>
                  Card: <span className="font-mono text-white">{TEST_CREDENTIALS.cardSuccess}</span>
                </li>
                <li>
                  Declined: <span className="font-mono text-white">{TEST_CREDENTIALS.cardDeclined}</span>
                </li>
                <li>OTP: {TEST_CREDENTIALS.otpHint}</li>
              </ul>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10.5px] text-white/55">
              <LockIcon className="h-3 w-3 shrink-0" />
              <span>
                Secured by <b className="font-semibold text-white/80">MECHmetriQ Pay</b> · 256-bit SSL
              </span>
            </div>
          </div>
        </aside>

        {/* ---------------- Right: method flow ---------------- */}
        <section className="relative flex min-h-0 flex-1 flex-col bg-[#fbfbfa]">
          {title[step] && (
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-grid bg-surface px-4">
              {step !== "home" && (
                <button
                  type="button"
                  onClick={back}
                  aria-label="Back"
                  className="grid h-8 w-8 place-items-center rounded-md text-ink-2 hover:bg-plane"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <h2 className="text-[14.5px] font-bold text-ink">{title[step]}</h2>
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close"
                className="ml-auto grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-plane hover:text-ink"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </header>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {step === "home" && (
              <div className="p-4">
                <div className="mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-wider text-muted">
                  Recommended
                </div>
                <MethodRow
                  icon={<UpiIcon />}
                  title="UPI / QR"
                  sub="Google Pay, PhonePe, Paytm & more"
                  badge="Instant"
                  onClick={() => go("upi")}
                />
                <div className="mb-2 mt-5 px-1 text-[11.5px] font-semibold uppercase tracking-wider text-muted">
                  All payment options
                </div>
                <div className="overflow-hidden rounded-xl border border-grid bg-surface">
                  <MethodRow flush icon={<CardIcon />} title="Cards" sub="Visa, Mastercard, RuPay & Amex" onClick={() => go("card")} />
                  <MethodRow flush icon={<BankIcon />} title="Netbanking" sub="All major Indian banks" onClick={() => go("netbanking")} />
                  <MethodRow flush icon={<WalletIcon />} title="Wallets" sub="Paytm, PhonePe, Amazon Pay & more" onClick={() => go("wallet")} />
                </div>
                <details className="mt-4 rounded-lg border border-[#e0c26a] bg-warn-bg/60 px-3 py-2 text-[11.5px] text-[#6b4d00] sm:hidden">
                  <summary className="cursor-pointer font-semibold">Test credentials</summary>
                  <ul className="mt-1.5 space-y-0.5">
                    <li>UPI: {TEST_CREDENTIALS.upiSuccess} (success) · {TEST_CREDENTIALS.upiFailure} (fails)</li>
                    <li>Card: {TEST_CREDENTIALS.cardSuccess} · declined: {TEST_CREDENTIALS.cardDeclined}</li>
                    <li>OTP: {TEST_CREDENTIALS.otpHint}</li>
                  </ul>
                </details>
                <p className="mt-5 px-1 text-center text-[11px] text-muted">
                  By proceeding you agree to MECHmetriQ&rsquo;s terms of sale. Payments in this environment are simulated.
                </p>
              </div>
            )}

            {step === "upi" && (
              <div className="p-5">
                <label htmlFor="gw-vpa" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
                  UPI ID
                </label>
                <input
                  id="gw-vpa"
                  autoFocus
                  value={vpa}
                  onChange={(e) => setVpa(e.target.value.trim())}
                  onKeyDown={(e) => e.key === "Enter" && submitUpi()}
                  placeholder="example@okhdfcbank"
                  autoComplete="off"
                  className="w-full rounded-lg border border-grid bg-surface px-3.5 py-3 text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                />
                {vpa && !VPA_RE.test(vpa) && (
                  <p className="mt-1.5 text-[12px] text-crit">Enter a valid UPI ID, e.g. name@bank</p>
                )}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {["@okhdfcbank", "@okaxis", "@ybl", "@paytm"].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setVpa((v) => (v.split("@")[0] || "name") + h)}
                      className="rounded-full border border-grid bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-2 hover:border-brand hover:text-brand"
                    >
                      {h}
                    </button>
                  ))}
                </div>

                <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <span className="h-px flex-1 bg-grid" /> or <span className="h-px flex-1 bg-grid" />
                </div>

                <button
                  type="button"
                  onClick={() => go("upi_qr")}
                  className="flex w-full items-center gap-3.5 rounded-xl border border-grid bg-surface p-3.5 text-left hover:border-brand"
                >
                  <div className="rounded-md border border-grid p-1">
                    <FakeQr seed={reference} size={52} />
                  </div>
                  <div>
                    <div className="text-[13.5px] font-semibold text-ink">Pay using QR code</div>
                    <div className="text-[12px] text-muted">Scan with any UPI app on your phone</div>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 text-muted" />
                </button>
              </div>
            )}

            {step === "upi_qr" && (
              <UpiQr
                seed={reference}
                amount={amount}
                onSimulate={(ok) =>
                  void process("upi", "UPI QR", ok ? undefined : "The payment was declined in your UPI app.")
                }
                onExpire={() => {
                  setResult({ paymentRef: newPaymentRef(), paidAt: new Date().toISOString(), reason: "The QR code expired before payment was made." });
                  setStep("failed");
                }}
              />
            )}

            {step === "upi_wait" && (
              <UpiWait
                vpa={vpa}
                amount={amount}
                onComplete={() =>
                  void process(
                    "upi",
                    `UPI · ${vpa}`,
                    vpa.toLowerCase() === TEST_CREDENTIALS.upiFailure
                      ? "The payment request was declined in the UPI app."
                      : undefined
                  )
                }
              />
            )}

            {step === "card" && (
              <div className="p-5">
                <div className="space-y-3.5">
                  <Field label="Card number" error={cardErrors.number}>
                    <div className="relative">
                      <input
                        autoFocus
                        inputMode="numeric"
                        autoComplete="cc-number"
                        value={card.number}
                        onChange={(e) => setCard((c) => ({ ...c, number: formatCardNumber(e.target.value) }))}
                        placeholder="1234 5678 9012 3456"
                        className={inputCls(!!cardErrors.number) + " pr-24 font-mono tracking-wide"}
                      />
                      {cardBrand(card.number) && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-grid bg-surface px-1.5 py-0.5 text-[10.5px] font-extrabold italic tracking-wide text-brand-dark">
                          {cardBrand(card.number)}
                        </span>
                      )}
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Expiry" error={cardErrors.expiry}>
                      <input
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        value={card.expiry}
                        onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                        placeholder="MM / YY"
                        className={inputCls(!!cardErrors.expiry) + " font-mono"}
                      />
                    </Field>
                    <Field label="CVV" error={cardErrors.cvv}>
                      <input
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        type="password"
                        value={card.cvv}
                        onChange={(e) => setCard((c) => ({ ...c, cvv: digitsOnly(e.target.value).slice(0, 4) }))}
                        placeholder="•••"
                        className={inputCls(!!cardErrors.cvv) + " font-mono"}
                      />
                    </Field>
                  </div>
                  <Field label="Name on card" error={cardErrors.name}>
                    <input
                      autoComplete="cc-name"
                      value={card.name}
                      onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                      placeholder="As printed on the card"
                      className={inputCls(!!cardErrors.name)}
                      onKeyDown={(e) => e.key === "Enter" && submitCard()}
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-[12px] text-muted">
                    <input type="checkbox" disabled /> Save this card securely for future payments (RBI guidelines)
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCard({ number: TEST_CREDENTIALS.cardSuccess, expiry: "12 / 30", cvv: "123", name: "Test Buyer" })
                  }
                  className="mt-4 text-[12px] font-semibold text-brand hover:underline"
                >
                  Use test card
                </button>
              </div>
            )}

            {step === "otp" && (
              <div className="p-5">
                <div className="overflow-hidden rounded-xl border border-grid bg-surface">
                  <div className="flex items-center justify-between bg-[#f2f5fa] px-4 py-3">
                    <div className="text-[13px] font-bold text-[#0e3466]">
                      {cardBrand(card.number) ?? "Card"} · Secure authentication
                    </div>
                    <LockIcon className="h-4 w-4 text-[#0e3466]" />
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 py-3.5 text-[12.5px]">
                    <dt className="text-muted">Merchant</dt>
                    <dd className="font-medium text-ink">MECHmetriQ</dd>
                    <dt className="text-muted">Amount</dt>
                    <dd className="font-semibold text-ink">{inr(amount)}</dd>
                    <dt className="text-muted">Card</dt>
                    <dd className="font-mono text-ink">•••• •••• •••• {digitsOnly(card.number).slice(-4)}</dd>
                  </dl>
                </div>
                <p className="mt-4 text-[13px] text-ink-2">
                  Enter the one-time password sent to your bank-registered mobile number
                  {contact.phone ? ` ending in ${digitsOnly(contact.phone).slice(-2)}` : ""}.
                </p>
                <input
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => {
                    setOtp(digitsOnly(e.target.value).slice(0, 6));
                    setOtpError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && submitOtp()}
                  placeholder="––––––"
                  aria-label="One-time password"
                  className={inputCls(!!otpError) + " mt-3 text-center font-mono text-[22px] tracking-[0.5em]"}
                />
                {otpError && <p className="mt-1.5 text-[12px] font-medium text-crit">{otpError}</p>}
                <ResendTimer />
              </div>
            )}

            {step === "netbanking" && (
              <div className="p-4">
                <div className="grid grid-cols-4 gap-2">
                  {BANKS.map((b) => (
                    <button
                      key={b.code}
                      type="button"
                      onClick={() => setBank(b.code)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border bg-surface px-1 py-3 text-[11.5px] font-semibold text-ink-2 transition",
                        bank === b.code ? "border-brand ring-2 ring-brand/15" : "border-grid hover:border-brand/50"
                      )}
                    >
                      <span
                        className="grid h-9 w-9 place-items-center rounded-full text-[10.5px] font-black text-white"
                        style={{ background: b.color }}
                      >
                        {b.short.slice(0, 4)}
                      </span>
                      {b.short}
                    </button>
                  ))}
                </div>
                <label className="mb-1.5 mt-5 block text-[12.5px] font-semibold text-ink-2" htmlFor="gw-other-bank">
                  Other banks
                </label>
                <select
                  id="gw-other-bank"
                  value={BANKS.some((b) => b.code === bank) ? "" : bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="w-full rounded-lg border border-grid bg-surface px-3 py-2.5 text-[13.5px] outline-none focus:border-brand"
                >
                  <option value="">Select a bank</option>
                  {OTHER_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {step === "wallet" && (
              <div className="p-4">
                <div className="overflow-hidden rounded-xl border border-grid bg-surface">
                  {WALLETS.map((w) => (
                    <label
                      key={w.code}
                      className="flex cursor-pointer items-center gap-3 border-b border-grid px-4 py-3.5 last:border-b-0 hover:bg-plane/60"
                    >
                      <span
                        className="grid h-8 w-8 place-items-center rounded-lg text-[12px] font-black text-white"
                        style={{ background: w.color }}
                      >
                        {w.name[0]}
                      </span>
                      <span className="text-[13.5px] font-semibold text-ink">{w.name}</span>
                      <input
                        type="radio"
                        name="gw-wallet"
                        className="ml-auto accent-[#2a78d6]"
                        checked={wallet === w.code}
                        onChange={() => setWallet(w.code)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {step === "bank" && (
              <SimulatedProviderPage
                name={providerName}
                color={providerColor}
                isWallet={!!selectedWallet}
                amount={amount}
                reference={reference}
                onOutcome={(ok) =>
                  void process(
                    selectedWallet ? "wallet" : "netbanking",
                    providerName,
                    ok
                      ? undefined
                      : selectedWallet
                        ? "The payment was cancelled in the wallet."
                        : "The transaction was declined by your bank."
                  )
                }
                onCancel={back}
              />
            )}

            {step === "processing" && (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <div className="relative h-16 w-16">
                  <div className="absolute inset-0 rounded-full border-4 border-brand-light" />
                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-brand" />
                  <LockIcon className="absolute inset-0 m-auto h-5 w-5 text-brand" />
                </div>
                <h3 className="mt-5 text-[16px] font-bold text-ink">Processing your payment</h3>
                <p className="mt-1 text-[13px] text-ink-2">
                  {inr(amount)} via {methodDetail || PAY_METHOD_LABEL[method]}
                </p>
                <p key={processingText} className="animate-field-in mt-4 text-[12.5px] font-medium text-brand-dark">
                  {processingText}
                </p>
                <p className="mt-8 rounded-lg bg-warn-bg px-3 py-2 text-[11.5px] font-medium text-[#7a5600]">
                  Please don&rsquo;t press back, refresh or close this window.
                </p>
              </div>
            )}

            {step === "success" && result && (
              <SuccessScreen
                amount={amount}
                method={methodDetail || PAY_METHOD_LABEL[method]}
                paymentRef={result.paymentRef}
                paidAt={result.paidAt}
                onContinue={() => result.orderId && onDone(result.orderId)}
              />
            )}

            {step === "failed" && result && (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <div className="gw-pop grid h-16 w-16 place-items-center rounded-full bg-crit-bg">
                  <XIcon className="h-7 w-7 text-crit" strokeWidth={3} />
                </div>
                <h3 className="mt-4 text-[17px] font-bold text-ink">Payment failed</h3>
                <p className="mt-1.5 max-w-[340px] text-[13px] text-ink-2">{result.reason}</p>
                <div className="mt-4 rounded-lg border border-grid bg-surface px-4 py-2.5 text-[11.5px] text-muted">
                  Payment ID <span className="font-mono text-ink-2">{result.paymentRef}</span>
                  <br />
                  If any amount was debited, it will be refunded within 5–7 working days.
                </div>
                <div className="mt-6 flex w-full max-w-[300px] flex-col gap-2">
                  <button
                    type="button"
                    onClick={restart}
                    className="rounded-[9px] bg-brand py-3 text-[14px] font-bold text-white hover:bg-brand-dark"
                  >
                    Retry payment
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
                  >
                    Back to checkout
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer pay button for form steps */}
          {(step === "upi" || step === "card" || step === "otp" || step === "netbanking" || step === "wallet") && (
            <footer className="shrink-0 border-t border-grid bg-surface px-4 py-3">
              <button
                type="button"
                disabled={
                  (step === "upi" && !VPA_RE.test(vpa)) ||
                  (step === "netbanking" && !bank) ||
                  (step === "wallet" && !wallet) ||
                  (step === "otp" && otp.length !== 6)
                }
                onClick={() => {
                  if (step === "upi") submitUpi();
                  else if (step === "card") submitCard();
                  else if (step === "otp") submitOtp();
                  else go("bank");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-[9px] bg-brand py-3 text-[14.5px] font-bold text-white hover:bg-brand-dark disabled:opacity-45"
              >
                <LockIcon className="h-3.5 w-3.5" />
                {step === "otp" ? "Submit OTP" : step === "upi" ? `Verify and pay ${inr(amount)}` : `Pay ${inr(amount)}`}
              </button>
            </footer>
          )}

          {confirmClose && (
            <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/30 sm:items-center">
              <div className="gw-pop m-4 w-full max-w-[340px] rounded-xl bg-surface p-5 shadow-xl">
                <h3 className="text-[15px] font-bold text-ink">Cancel this payment?</h3>
                <p className="mt-1.5 text-[13px] text-ink-2">Your order will not be placed until the payment is completed.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClose(false)}
                    className="rounded-lg px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-plane"
                  >
                    Continue paying
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg bg-crit px-3.5 py-2 text-[13px] font-bold text-white"
                  >
                    Yes, cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-screens
// ---------------------------------------------------------------------------

function UpiWait({ vpa, amount, onComplete }: { vpa: string; amount: number; onComplete: () => void }) {
  const [left, setLeft] = useState(300);
  const done = useRef(onComplete);
  useEffect(() => {
    done.current = onComplete;
  });
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    // Simulated: the buyer "approves" in their UPI app after a few seconds.
    const approve = setTimeout(() => done.current(), 4500);
    return () => {
      clearInterval(t);
      clearTimeout(approve);
    };
  }, []);
  const pct = left / 300;
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="relative grid h-24 w-24 place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#eaf2fc" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#2a78d6"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 44}
            strokeDashoffset={2 * Math.PI * 44 * (1 - pct)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <PhoneIcon className="h-8 w-8 text-brand" />
      </div>
      <div className="mt-3 font-mono text-[15px] font-bold text-ink">
        {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
      </div>
      <h3 className="mt-3 text-[15.5px] font-bold text-ink">Open your UPI app to approve</h3>
      <p className="mt-1.5 text-[13px] text-ink-2">
        A collect request of <b>{inr(amount)}</b> has been sent to
        <br />
        <span className="font-mono text-ink">{vpa}</span>
      </p>
      <ol className="mt-5 space-y-1.5 text-left text-[12.5px] text-ink-2">
        <li>1. Open the UPI app linked to this UPI ID</li>
        <li>2. Check pending requests and approve the payment</li>
        <li>3. Enter your UPI PIN to complete</li>
      </ol>
      <div className="mt-6 flex items-center gap-2 text-[12px] text-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent-aqua" /> Waiting for approval…
      </div>
    </div>
  );
}

function UpiQr({
  seed,
  amount,
  onSimulate,
  onExpire,
}: {
  seed: string;
  amount: number;
  onSimulate: (ok: boolean) => void;
  onExpire: () => void;
}) {
  const [left, setLeft] = useState(300);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left === 0) expire.current();
  }, [left]);
  return (
    <div className="flex flex-col items-center px-6 py-5 text-center">
      <div className="rounded-2xl border border-grid bg-white p-3 shadow-sm">
        <FakeQr seed={seed} size={176} />
      </div>
      <div className="mt-3 text-[18px] font-extrabold text-ink">{inr(amount)}</div>
      <p className="text-[12.5px] text-ink-2">Scan with Google Pay, PhonePe, Paytm or any UPI app</p>
      <p className="mt-1 text-[12px] text-muted">
        QR expires in{" "}
        <span className="font-mono font-semibold text-ink">
          {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
        </span>
      </p>
      <div className="mt-5 w-full rounded-xl border border-dashed border-[#e0c26a] bg-warn-bg/60 p-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#7a5600]">Test mode · simulate scan</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSimulate(true)}
            className="flex-1 rounded-lg bg-good py-2 text-[12.5px] font-bold text-white"
          >
            Payment successful
          </button>
          <button
            type="button"
            onClick={() => onSimulate(false)}
            className="flex-1 rounded-lg border border-crit/40 bg-surface py-2 text-[12.5px] font-bold text-crit"
          >
            Payment failed
          </button>
        </div>
      </div>
    </div>
  );
}

function SimulatedProviderPage({
  name,
  color,
  isWallet,
  amount,
  reference,
  onOutcome,
  onCancel,
}: {
  name: string;
  color: string;
  isWallet: boolean;
  amount: number;
  reference: string;
  onOutcome: (ok: boolean) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1100);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-grid bg-[#f1f1ef] px-3 py-2 text-[11px] text-muted">
        <LockIcon className="h-3 w-3 text-good" />
        <span className="truncate font-mono">
          https://{isWallet ? "wallet" : "netbanking"}.{name.toLowerCase().replace(/[^a-z]/g, "")}.test/pay?ref={reference}
        </span>
      </div>
      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[13px] text-ink-2">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-grid border-t-brand" />
          Redirecting to {name}…
        </div>
      ) : (
        <div className="animate-field-in flex flex-1 flex-col">
          <div className="px-5 py-4 text-white" style={{ background: color }}>
            <div className="text-[16px] font-extrabold">{name}</div>
            <div className="text-[11.5px] opacity-80">{isWallet ? "Wallet payment" : "NetBanking"} · Test environment</div>
          </div>
          <div className="flex-1 space-y-4 p-5">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-grid bg-surface px-4 py-3 text-[12.5px]">
              <dt className="text-muted">Pay to</dt>
              <dd className="font-medium text-ink">MECHmetriQ (i-Source Infosystems)</dd>
              <dt className="text-muted">Amount</dt>
              <dd className="font-bold text-ink">{inr(amount)}</dd>
              <dt className="text-muted">Reference</dt>
              <dd className="font-mono text-ink">{reference}</dd>
            </dl>
            {!isWallet && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-[11.5px] font-semibold text-ink-2">Customer ID</div>
                  <input disabled value="TESTUSER01" className={inputCls(false) + " bg-plane text-muted"} />
                </div>
                <div>
                  <div className="mb-1 text-[11.5px] font-semibold text-ink-2">Password</div>
                  <input disabled type="password" value="password" className={inputCls(false) + " bg-plane text-muted"} />
                </div>
              </div>
            )}
            <p className="rounded-lg bg-warn-bg px-3 py-2 text-[12px] text-[#7a5600]">
              This is a simulated {isWallet ? "wallet" : "bank"} page. Choose how the payment should end.
            </p>
          </div>
          <div className="flex gap-2 border-t border-grid bg-surface p-4">
            <button
              type="button"
              onClick={() => onOutcome(true)}
              className="flex-1 rounded-[9px] py-3 text-[14px] font-bold text-white"
              style={{ background: color }}
            >
              Success
            </button>
            <button
              type="button"
              onClick={() => onOutcome(false)}
              className="flex-1 rounded-[9px] border border-crit/40 bg-surface py-3 text-[14px] font-bold text-crit"
            >
              Failure
            </button>
          </div>
          <button type="button" onClick={onCancel} className="pb-3 text-[12px] font-semibold text-muted hover:text-ink">
            Cancel and go back
          </button>
        </div>
      )}
    </div>
  );
}

function SuccessScreen({
  amount,
  method,
  paymentRef,
  paidAt,
  onContinue,
}: {
  amount: number;
  method: string;
  paymentRef: string;
  paidAt: string;
  onContinue: () => void;
}) {
  const [left, setLeft] = useState(5);
  const cont = useRef(onContinue);
  useEffect(() => {
    cont.current = onContinue;
  });
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left === 0) cont.current();
  }, [left]);
  const when = new Date(paidAt).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="gw-pop grid h-[72px] w-[72px] place-items-center rounded-full bg-good shadow-[0_0_0_10px_#e7f8e7]">
        <svg viewBox="0 0 24 24" className="h-9 w-9 text-white" fill="none" stroke="currentColor" strokeWidth={3}>
          <path d="M5 12.5l4.5 4.5L19 7.5" className="gw-check" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="mt-5 text-[18px] font-bold text-ink">Payment successful</h3>
      <div className="mt-1 text-[26px] font-extrabold tracking-tight text-ink">{inr(amount)}</div>
      <dl className="mt-4 grid w-full max-w-[340px] grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-grid bg-surface px-4 py-3 text-left text-[12.5px]">
        <dt className="text-muted">Payment ID</dt>
        <dd className="truncate text-right font-mono text-ink">{paymentRef}</dd>
        <dt className="text-muted">Paid via</dt>
        <dd className="truncate text-right text-ink">{method}</dd>
        <dt className="text-muted">Date &amp; time</dt>
        <dd className="text-right text-ink">{when}</dd>
      </dl>
      <button
        type="button"
        onClick={onContinue}
        className="mt-6 w-full max-w-[340px] rounded-[9px] bg-brand py-3 text-[14px] font-bold text-white hover:bg-brand-dark"
      >
        View my order
      </button>
      <p className="mt-2 text-[12px] text-muted">Taking you to your order in {Math.max(left, 0)}s…</p>
    </div>
  );
}

function ResendTimer() {
  const [left, setLeft] = useState(30);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <div className="mt-3 flex items-center justify-between text-[12px]">
      <span className="text-muted">{sent ? "A new OTP has been sent." : "Didn’t receive the OTP?"}</span>
      {left > 0 ? (
        <span className="text-muted">Resend in 00:{String(left).padStart(2, "0")}</span>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSent(true);
            setLeft(30);
          }}
          className="font-semibold text-brand hover:underline"
        >
          Resend OTP
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function MethodRow({
  icon,
  title,
  sub,
  badge,
  flush,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  badge?: string;
  flush?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3.5 bg-surface px-4 py-3.5 text-left transition hover:bg-brand-light/50",
        flush ? "border-b border-grid last:border-b-0" : "rounded-xl border border-grid hover:border-brand/50"
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-grid bg-surface text-brand-dark">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
          {title}
          {badge && (
            <span className="rounded-full bg-good-bg px-2 py-[1px] text-[10px] font-bold text-[#0a6b0a]">{badge}</span>
          )}
        </span>
        <span className="block truncate text-[12px] text-muted">{sub}</span>
      </span>
      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
    </button>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[12.5px] font-semibold text-ink-2">{label}</div>
      {children}
      {error && <p className="mt-1 text-[11.5px] font-medium text-crit">{error}</p>}
    </div>
  );
}

function inputCls(err: boolean) {
  return cn(
    "w-full rounded-lg border bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:ring-2",
    err ? "border-crit focus:ring-crit/15" : "border-grid focus:border-brand focus:ring-brand/15"
  );
}

/** Deterministic QR-looking pattern (not scannable — test mode). */
function FakeQr({ seed, size }: { seed: string; size: number }) {
  const n = 25;
  const cells = useMemo(() => {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const rand = () => {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      return ((h >>> 0) % 1000) / 1000;
    };
    const out: [number, number][] = [];
    const inFinder = (x: number, y: number) =>
      (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) if (!inFinder(x, y) && rand() > 0.52) out.push([x, y]);
    return out;
  }, [seed]);
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="#0b0b0b" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="#0b0b0b" />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" aria-label="UPI QR code">
      <rect width={n} height={n} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} fill="#0b0b0b" />
      ))}
      {finder(0, 0)}
      {finder(n - 7, 0)}
      {finder(0, n - 7)}
      <rect x={n / 2 - 2.5} y={n / 2 - 2.5} width={5} height={5} rx={1} fill="#fff" />
      <rect x={n / 2 - 1.8} y={n / 2 - 1.8} width={3.6} height={3.6} rx={0.8} fill="#2a78d6" />
    </svg>
  );
}

type IconProps = { className?: string; strokeWidth?: number };
const icon = (d: React.ReactNode) =>
  function Icon({ className = "h-5 w-5", strokeWidth = 2 }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {d}
      </svg>
    );
  };

const XIcon = icon(<path d="M18 6L6 18M6 6l12 12" />);
const ChevronLeft = icon(<path d="M15 18l-6-6 6-6" />);
const ChevronRight = icon(<path d="M9 18l6-6-6-6" />);
const LockIcon = icon(
  <>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </>
);
const ShieldIcon = icon(
  <>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </>
);
const PhoneIcon = icon(
  <>
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <path d="M11 18h2" />
  </>
);
const MailIcon = icon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </>
);
const CardIcon = icon(
  <>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M2.5 10h19M6 15h4" />
  </>
);
const BankIcon = icon(
  <>
    <path d="M3 10l9-6 9 6" />
    <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />
  </>
);
const WalletIcon = icon(
  <>
    <path d="M3 7a2 2 0 012-2h13v4" />
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <circle cx="16.5" cy="13.5" r="1.2" />
  </>
);
function UpiIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path d="M10.5 3l-5 18h3.2l5-18z" fill="#2a78d6" />
      <path d="M15 3l-5 18h3.2l5-18z" fill="#1baf7a" />
    </svg>
  );
}
