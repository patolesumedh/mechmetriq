"use client";

import type { KycView } from "@/lib/kyc/server";
import { MAX_CERTIFICATIONS, PRIVACY_CONTACT_EMAIL, type FieldErrors } from "@/lib/kyc/rules";
import { DocUpload } from "./DocUpload";

export const kycInputClass =
  "w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand";
export const kycLabelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";

export type { FieldErrors, KycFormState } from "@/lib/kyc/rules";

function inputCls(err?: string) {
  return kycInputClass + (err ? " border-crit" : "");
}

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-[12px] text-crit">{msg}</p> : null;
}

function OnFile({ masked }: { masked: string | null }) {
  return masked ? (
    <p className="mt-1 text-[11.5px] text-muted">
      On file: <span className="font-mono">{masked}</span> · leave blank to keep
    </p>
  ) : null;
}

const noAutofill = { autoComplete: "off", spellCheck: false } as const;

export function PanField({
  kyc,
  errors,
  required,
}: {
  kyc: KycView;
  errors?: FieldErrors;
  required?: boolean;
}) {
  return (
    <div>
      <label className={kycLabelClass}>
        PAN {required && !kyc.panMasked && <span className="text-crit">*</span>}
      </label>
      <input
        name="pan"
        maxLength={10}
        placeholder={kyc.panMasked ? "Enter new PAN to change" : "10-character PAN"}
        className={inputCls(errors?.pan) + " uppercase"}
        {...noAutofill}
      />
      <OnFile masked={kyc.panMasked} />
      <Err msg={errors?.pan} />
    </div>
  );
}

export function AddressField({ kyc, errors }: { kyc: KycView; errors?: FieldErrors }) {
  return (
    <div>
      <label className={kycLabelClass}>Registered address</label>
      <input
        name="registered_address"
        defaultValue={kyc.registeredAddress ?? ""}
        placeholder="Full address"
        maxLength={500}
        className={inputCls(errors?.registered_address)}
      />
      <Err msg={errors?.registered_address} />
    </div>
  );
}

export function BankFields({
  kyc,
  vendorId,
  errors,
}: {
  kyc: KycView;
  vendorId: string;
  errors?: FieldErrors;
}) {
  return (
    <>
      <div className="mb-3.5">
        <label className={kycLabelClass}>Account holder name</label>
        <input
          name="account_holder_name"
          defaultValue={kyc.accountHolderName ?? ""}
          placeholder="As printed on the cheque / passbook"
          maxLength={120}
          className={inputCls(errors?.account_holder_name)}
        />
        <Err msg={errors?.account_holder_name} />
      </div>
      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <div>
          <label className={kycLabelClass}>Bank account number</label>
          <input
            name="bank_account_number"
            inputMode="numeric"
            maxLength={18}
            placeholder={kyc.bankAccountMasked ? "Enter new number to change" : "9-18 digits"}
            className={inputCls(errors?.bank_account_number)}
            {...noAutofill}
          />
          <OnFile masked={kyc.bankAccountMasked} />
          <Err msg={errors?.bank_account_number} />
        </div>
        <div>
          <label className={kycLabelClass}>Re-enter account number</label>
          <input
            name="bank_account_number_confirm"
            inputMode="numeric"
            maxLength={18}
            placeholder="Type it again to confirm"
            className={inputCls(errors?.bank_account_number_confirm)}
            onPaste={(e) => e.preventDefault()}
            {...noAutofill}
          />
          <Err msg={errors?.bank_account_number_confirm} />
        </div>
      </div>
      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <div>
          <label className={kycLabelClass}>IFSC code</label>
          <input
            name="ifsc_code"
            maxLength={11}
            placeholder={kyc.ifscMasked ? "Enter new IFSC to change" : "11-character IFSC"}
            className={inputCls(errors?.ifsc_code) + " uppercase"}
            {...noAutofill}
          />
          <OnFile masked={kyc.ifscMasked} />
          <Err msg={errors?.ifsc_code} />
        </div>
      </div>
      <div className="mb-3.5">
        <label className={kycLabelClass}>Cancelled cheque or bank passbook (front page)</label>
        <DocUpload
          vendorId={vendorId}
          name="cancelled_cheque_path"
          kind="cheque"
          initialPaths={kyc.cancelledChequePath ? [kyc.cancelledChequePath] : []}
          error={errors?.cancelled_cheque_path}
        />
      </div>
      <div>
        <label className={kycLabelClass}>Certifications (optional)</label>
        <p className="mb-2 text-[11.5px] text-muted">
          ISO 9001, AS9100, mill test certificates, etc. Up to {MAX_CERTIFICATIONS} files.
        </p>
        <DocUpload
          vendorId={vendorId}
          name="certification_paths"
          kind="cert"
          initialPaths={kyc.certificationPaths}
          multiple
          max={MAX_CERTIFICATIONS}
          error={errors?.certification_paths}
        />
      </div>
    </>
  );
}

export function ConsentBlock({ kyc, errors }: { kyc: KycView; errors?: FieldErrors }) {
  return (
    <div className="mb-4.5 rounded-[10px] border border-grid bg-surface p-6 text-[12.5px] leading-relaxed text-ink-2">
      <h3 className="mb-2 text-[14.5px] font-semibold text-ink">How we use your details</h3>
      <ul className="mb-3 list-disc space-y-1 pl-5">
        <li>
          <b>What we collect:</b> business and contact details, PAN, GSTIN, registered address,
          bank account details and the documents you upload.
        </li>
        <li>
          <b>Why:</b> only to verify your business, generate GST-compliant invoices and pay you for
          delivered orders. We don&rsquo;t use it for marketing and don&rsquo;t sell it.
        </li>
        <li>
          <b>Protection:</b> PAN and bank details are encrypted, shown back only in masked form,
          and visible in full only to authorised MECHmetrIQ staff. Every access is logged.
        </li>
        <li>
          <b>How long:</b> while you are an active vendor, and after that only as long as tax and
          accounting law requires. Then it is deleted.
        </li>
        <li>
          <b>Your rights:</b> you can see and correct your details on this page, withdraw consent
          or ask us to delete them, and raise a grievance, by writing to{" "}
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="font-semibold text-brand">
            {PRIVACY_CONTACT_EMAIL}
          </a>
          .
        </li>
      </ul>
      {kyc.consentCurrent ? (
        <p className="text-muted">
          You gave consent on{" "}
          {new Date(kyc.consentAt!).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          .
        </p>
      ) : (
        <label className="flex items-start gap-2.5 font-medium text-ink">
          <input type="checkbox" name="consent" value="yes" className="mt-0.5 h-4 w-4" />
          <span>
            I have read this notice and consent to MECHmetrIQ processing these details for the
            purposes above.
          </span>
        </label>
      )}
      <Err msg={errors?.consent} />
    </div>
  );
}
