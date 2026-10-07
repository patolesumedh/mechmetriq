"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { TestPaymentGateway } from "@/components/payments/TestPaymentGateway";
import { GSTIN_RE } from "@/lib/kyc/rules";
import { payQuoteAction } from "./actions";

interface Address {
  id: string;
  label: string;
  full_address: string;
  pincode: string;
  is_default: boolean;
}

interface Props {
  rfqId: string;
  defaultAddressId: string | null;
  addresses: Address[];
  defaultGstin: string;
  organization: string | null;
  description: string;
  reference: string;
  contact: { email: string; phone: string | null };
  summary: {
    unit: number;
    quantity: number;
    subtotal: number;
    gst: number;
    total: number;
    validUntil: string;
    leadDays: number | null;
  };
  children: React.ReactNode;
}

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CheckoutForm({
  rfqId,
  defaultAddressId,
  addresses,
  defaultGstin,
  organization,
  description,
  reference,
  contact,
  summary,
  children,
}: Props) {
  const router = useRouter();
  const initialAddress =
    addresses.find((a) => a.id === defaultAddressId)?.id ??
    addresses.find((a) => a.is_default)?.id ??
    addresses[0]?.id ??
    "";
  const [addressId, setAddressId] = useState(initialAddress);
  const [gstin, setGstin] = useState(defaultGstin);
  const [agreed, setAgreed] = useState(false);
  const [open, setOpen] = useState(false);

  const gstinInvalid = gstin.trim() !== "" && !GSTIN_RE.test(gstin.trim().toUpperCase());
  const canPay = !!addressId && agreed && !gstinInvalid;

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.55fr_1fr]">
      <div className="flex flex-col gap-5">
        {children}

        <Card>
          <CardHeader title="Delivery address" action={{ label: "Manage", href: "/buyer/addresses" }} />
          <div className="px-5 py-4">
            {addresses.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-grid px-3.5 py-3 text-[13px] has-[:checked]:border-brand has-[:checked]:bg-brand-light"
                  >
                    <input
                      type="radio"
                      name="delivery_address_id"
                      value={a.id}
                      checked={addressId === a.id}
                      onChange={() => setAddressId(a.id)}
                      className="mt-0.5 accent-[#2a78d6]"
                    />
                    <span>
                      <b className="block text-ink">
                        {a.label}
                        {a.is_default && <span className="ml-1.5 text-[11px] font-semibold text-brand">Default</span>}
                      </b>
                      <span className="text-ink-2">
                        {a.full_address} — {a.pincode}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-ink-2">
                You have no saved delivery address.{" "}
                <Link href="/buyer/addresses" className="font-semibold text-brand">
                  Add one
                </Link>{" "}
                to continue.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Billing" />
          <div className="px-5 py-4">
            {organization && <div className="mb-2 text-[13px] font-semibold text-ink">{organization}</div>}
            <label htmlFor="billing_gstin" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
              Billing GSTIN <span className="font-normal text-muted">(for input tax credit, optional)</span>
            </label>
            <input
              id="billing_gstin"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
              className="w-full max-w-sm rounded-lg border border-grid px-3.5 py-2.5 font-mono text-[13.5px] uppercase outline-none focus:border-brand"
            />
            {gstinInvalid && <p className="mt-1 text-[12px] text-crit">Enter a valid 15-character GSTIN, or leave it blank.</p>}
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-4 p-5 lg:sticky lg:top-5">
        <h3 className="text-[14.5px] font-semibold">Order summary</h3>
        <div className="flex flex-col gap-1.5 text-[13.5px]">
          <Row label={`${inr(summary.unit)} × ${summary.quantity} pcs`} value={inr(summary.subtotal)} />
          <Row label="Shipping" value="Included" />
          <Row label="GST (18%)" value={inr(summary.gst)} />
          <div className="my-1.5 border-t border-grid" />
          <div className="flex items-baseline justify-between">
            <span className="text-[14.5px] font-bold text-ink">Total payable</span>
            <span className="text-[22px] font-extrabold tracking-tight text-ink">{inr(summary.total)}</span>
          </div>
        </div>

        <div className="rounded-lg bg-plane px-3.5 py-2.5 text-[12px] text-ink-2">
          {summary.leadDays ? (
            <>
              Ships in <b className="text-ink">{summary.leadDays} working days</b> after payment.
              <br />
            </>
          ) : null}
          Price valid until <b className="text-ink">{summary.validUntil}</b>.
        </div>

        <label className="flex items-start gap-2 text-[12.5px] text-ink-2">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-[#2a78d6]"
          />
          <span>
            I confirm the part specification above and agree to MECHmetriQ&rsquo;s terms of sale, including the
            cancellation and quality policy.
          </span>
        </label>

        <button
          type="button"
          disabled={!canPay}
          onClick={() => setOpen(true)}
          className="flex items-center justify-center gap-2 rounded-[9px] bg-brand py-3 text-[14.5px] font-bold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 018 0v4" />
          </svg>
          Proceed to pay {inr(summary.total)}
        </button>
        {!addressId && <p className="-mt-2 text-center text-[11.5px] text-crit">Add a delivery address to continue.</p>}

        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10.5px] font-semibold text-muted">
          {["UPI", "Cards", "Netbanking", "Wallets"].map((m) => (
            <span key={m} className="rounded border border-grid px-1.5 py-0.5">
              {m}
            </span>
          ))}
        </div>
        <p className="-mt-1 text-center text-[11px] text-muted">
          <span className="mr-1 rounded bg-[#fff1c2] px-1.5 py-[1px] text-[9.5px] font-extrabold tracking-wider text-[#6b4d00]">
            TEST MODE
          </span>
          Payments are simulated — no money is charged.
        </p>
      </Card>

      {open && (
        <TestPaymentGateway
          amount={summary.total}
          description={description}
          reference={reference}
          contact={contact}
          authorize={(method) => payQuoteAction({ rfqId, addressId, billingGstin: gstin, method })}
          onClose={() => setOpen(false)}
          onDone={(orderId) => router.push(`/buyer/orders/${orderId}?paid=1`)}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-2">
      <span>{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
