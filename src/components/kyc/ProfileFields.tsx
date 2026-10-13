"use client";

import type { DetailsRow } from "@/lib/kyc/details";
import type { KycView } from "@/lib/kyc/server";
import {
  INDIAN_STATES,
  INDUSTRIES,
  INSPECTION_TOOLS,
  TOLERANCE_OPTIONS,
  docKindsFor,
  type FieldErrors,
  type VendorKind,
} from "@/lib/kyc/rules";
import { DocUpload } from "./DocUpload";
import { kycInputClass, kycLabelClass } from "./KycFields";

/*
 * Onboarding journey steps 2–5 for both vendor types: business profile extras,
 * primary contact, facility & operations, capability and additional documents.
 */

function cls(err?: string) {
  return kycInputClass + (err ? " border-crit" : "");
}

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-[12px] text-crit">{msg}</p> : null;
}

function Req() {
  return <span className="text-crit">*</span>;
}

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4.5 rounded-[10px] border border-grid bg-surface p-6">
      <h3 className="mb-1 text-[14.5px] font-semibold">{title}</h3>
      {subtitle && <p className="mb-4.5 text-[12.5px] text-muted">{subtitle}</p>}
      {!subtitle && <div className="mb-3.5" />}
      {children}
    </div>
  );
}

function Input({
  name,
  label,
  required,
  errors,
  defaultValue,
  placeholder,
  type = "text",
  inputMode,
  maxLength,
}: {
  name: string;
  label: string;
  required?: boolean;
  errors?: FieldErrors;
  defaultValue?: string | number | null;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
}) {
  return (
    <div>
      <label className={kycLabelClass}>
        {label} {required && <Req />}
      </label>
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={cls(errors?.[name])}
      />
      <Err msg={errors?.[name]} />
    </div>
  );
}

function TextArea({
  name,
  label,
  errors,
  defaultValue,
  placeholder,
  rows = 2,
  maxLength,
}: {
  name: string;
  label: string;
  errors?: FieldErrors;
  defaultValue?: string | null;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <div>
      <label className={kycLabelClass}>{label}</label>
      <textarea
        name={name}
        rows={rows}
        maxLength={maxLength}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={cls(errors?.[name])}
      />
      <Err msg={errors?.[name]} />
    </div>
  );
}

function Chips({
  name,
  label,
  options,
  selected,
}: {
  name: string;
  label: string;
  options: string[];
  selected: string[];
}) {
  const on = new Set(selected);
  return (
    <div>
      <label className={kycLabelClass}>{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o}
            className="cursor-pointer rounded-full border-[1.5px] border-grid px-3.5 py-2 text-[12.5px] font-semibold text-ink-2 has-[:checked]:border-brand has-[:checked]:bg-brand-light has-[:checked]:text-brand-dark"
          >
            <input type="checkbox" name={name} value={o} defaultChecked={on.has(o)} className="hidden" />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Step 2 extras: trade name, year, website, business email, Udyam no. */
export function BusinessProfileExtra({
  details,
  kyc,
  errors,
}: {
  details: DetailsRow | null;
  kyc: KycView;
  errors?: FieldErrors;
}) {
  return (
    <>
      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <Input name="trade_name" label="Trade / brand name" errors={errors} defaultValue={details?.trade_name} placeholder="If different from legal name" maxLength={200} />
        <Input name="year_established" label="Year of establishment" required errors={errors} defaultValue={details?.year_established} placeholder="e.g. 2012" inputMode="numeric" maxLength={4} />
      </div>
      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <Input name="business_email" label="Business email" required type="email" errors={errors} defaultValue={details?.business_email} placeholder="e.g. sales@yourcompany.com" maxLength={200} />
        <Input name="website" label="Website" errors={errors} defaultValue={details?.website} placeholder="www.yourcompany.com" maxLength={200} />
      </div>
      <div className="mb-3.5">
        <Input name="udyam_number" label="Udyam / MSME registration no." errors={errors} defaultValue={kyc.udyamNumber} placeholder="UDYAM-MH-26-0012345" maxLength={19} />
      </div>
    </>
  );
}

/** Step 2 address extras: line 2, city, state (line 1 + pincode live in each form). */
export function AddressExtraFields({ kyc, errors }: { kyc: KycView; errors?: FieldErrors }) {
  return (
    <>
      <div className="mt-3.5">
        <Input name="address_line2" label="Address line 2" errors={errors} defaultValue={kyc.addressLine2} placeholder="Area, landmark (optional)" maxLength={300} />
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-3">
        <Input name="city" label="City" required errors={errors} defaultValue={kyc.city} placeholder="e.g. Pune" maxLength={80} />
        <div>
          <label className={kycLabelClass}>
            State <Req />
          </label>
          <select name="state" defaultValue={kyc.state ?? ""} className={cls(errors?.state)}>
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Err msg={errors?.state} />
        </div>
      </div>
    </>
  );
}

/** Step 3a: primary contact person. */
export function PrimaryContactSection({ kyc, errors }: { kyc: KycView; errors?: FieldErrors }) {
  return (
    <Section title="Primary Contact" subtitle="The person our team will coordinate orders and payouts with.">
      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <Input name="contact_name" label="Name" required errors={errors} defaultValue={kyc.contactName} placeholder="Full name" maxLength={120} />
        <Input name="contact_designation" label="Designation" required errors={errors} defaultValue={kyc.contactDesignation} placeholder="e.g. Owner, Production Manager" maxLength={80} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="contact_mobile" label="Mobile" required errors={errors} defaultValue={kyc.contactMobile} placeholder="10-digit mobile" inputMode="tel" maxLength={14} />
        <Input name="contact_email" label="Email" required type="email" errors={errors} defaultValue={kyc.contactEmail} placeholder="name@yourcompany.com" maxLength={200} />
      </div>
    </Section>
  );
}

/** Step 3b: facility & operations. */
export function OperationsSection({
  details,
  errors,
  kind,
}: {
  details: DetailsRow | null;
  errors?: FieldErrors;
  kind: VendorKind;
}) {
  const fab = kind === "fabrication";
  return (
    <Section title="Facility & Operations" subtitle="Helps us plan which orders and volumes to send you.">
      <div className="mb-3.5">
        <TextArea name="facility_locations" label={fab ? "Factory / workshop locations" : "Warehouse / godown locations"} errors={errors} defaultValue={details?.facility_locations} placeholder="One per line, e.g. Plot 12, MIDC Bhosari, Pune" maxLength={500} />
      </div>
      <div className="mb-3.5 grid grid-cols-3 gap-3">
        <Input name="facility_count" label="Number of facilities" errors={errors} defaultValue={details?.facility_count} inputMode="numeric" maxLength={3} placeholder="e.g. 1" />
        <Input name="facility_area_sqft" label="Total area (sq ft)" errors={errors} defaultValue={details?.facility_area_sqft} inputMode="numeric" maxLength={9} placeholder="e.g. 5000" />
        <Input name="employee_count" label="Employees" errors={errors} defaultValue={details?.employee_count} inputMode="numeric" maxLength={7} placeholder="e.g. 25" />
      </div>
      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <Input name="working_hours" label="Working days / hours" errors={errors} defaultValue={details?.working_hours} placeholder="e.g. Mon–Sat, 2 shifts" maxLength={200} />
        <Input name="production_capacity" label={fab ? "Production capacity" : "Dispatch capacity"} errors={errors} defaultValue={details?.production_capacity} placeholder={fab ? "e.g. 5,000 machined parts / month" : "e.g. 20 tonnes / month"} maxLength={300} />
      </div>
      <Input name="serviceable_geography" label="Serviceable geography" errors={errors} defaultValue={details?.serviceable_geography} placeholder="e.g. All India, or Maharashtra & Gujarat" maxLength={300} />
    </Section>
  );
}

/** Step 4: fabrication capability (processes/materials stay in the form). */
export function FabricationCapabilityFields({
  details,
  errors,
}: {
  details: DetailsRow | null;
  errors?: FieldErrors;
}) {
  return (
    <>
      <div className="mb-4.5">
        <TextArea name="machines" label="Machines" errors={errors} defaultValue={details?.machines} rows={3} placeholder={"e.g. 3 × VMC (Haas VF-2), 2 × CNC lathe (Ace Jobber XL), 1 × 5-axis"} maxLength={1000} />
      </div>
      <div className="mb-4.5 grid grid-cols-2 gap-3">
        <Input name="max_job_size" label="Max job size" errors={errors} defaultValue={details?.max_job_size} placeholder="e.g. 1000 × 500 × 500 mm, Ø300 × 600 mm" maxLength={200} />
        <div>
          <label className={kycLabelClass}>Best tolerance you hold</label>
          <select name="tolerance_capability" defaultValue={details?.tolerance_capability ?? ""} className={cls(errors?.tolerance_capability)}>
            <option value="">Select tolerance</option>
            {TOLERANCE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Err msg={errors?.tolerance_capability} />
        </div>
      </div>
      <div className="mb-4.5">
        <Chips name="industries" label="Industries served" options={INDUSTRIES} selected={details?.industries ?? []} />
      </div>
      <div className="mb-4.5">
        <Chips name="inspection_capability" label="Inspection capability" options={INSPECTION_TOOLS} selected={details?.inspection_capability ?? []} />
      </div>
    </>
  );
}

/** Step 4: raw-material supplier details (grades & sizes are on the Supply page). */
export function SupplierCapabilityFields({
  details,
  errors,
}: {
  details: DetailsRow | null;
  errors?: FieldErrors;
}) {
  return (
    <>
      <p className="mb-3.5 rounded-lg bg-brand-light px-3.5 py-2.5 text-[12.5px] text-brand-dark">
        Grades, shapes and size ranges you stock are added under <b>Supply</b> after approval.
      </p>
      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <Input name="brands" label="Brands / mills you deal in" errors={errors} defaultValue={details?.brands} placeholder="e.g. Hindalco, Jindal, SAIL" maxLength={500} />
        <Input name="supply_capacity" label="Supply capacity" errors={errors} defaultValue={details?.supply_capacity} placeholder="e.g. 50 tonnes / month" maxLength={300} />
      </div>
      <div className="mb-3.5">
        <TextArea name="stock_locations" label="Stock held / warehouse details" errors={errors} defaultValue={details?.stock_locations} placeholder="e.g. Ahmedabad warehouse — ~20 t aluminium plates and bars in stock" maxLength={500} />
      </div>
      <div className="mb-3.5">
        <TextArea name="delivery_locations" label="Delivery locations" errors={errors} defaultValue={details?.delivery_locations} placeholder="e.g. Gujarat, Maharashtra, Rajasthan" maxLength={500} />
      </div>
    </>
  );
}

/** Step 5: additional documents (Udyam, GST, registration proof, photos, …). */
export function DocumentsSection({
  kyc,
  vendorId,
  kind,
  errors,
}: {
  kyc: KycView;
  vendorId: string;
  kind: VendorKind;
  errors?: FieldErrors;
}) {
  return (
    <Section title="Business Documents" subtitle="JPG, PNG or PDF, max 5 MB each. Stored privately; only our verification team can open them.">
      <div className="space-y-4.5">
        {docKindsFor(kind).map((d) => (
          <div key={d.key}>
            <label className={kycLabelClass}>
              {d.label} {d.required && <Req />}
            </label>
            {d.hint && <p className="mb-2 text-[11.5px] text-muted">{d.hint}</p>}
            <DocUpload
              vendorId={vendorId}
              name={`doc_${d.key}`}
              kind={d.key}
              initialPaths={kyc.documents[d.key] ?? []}
              multiple={d.max > 1}
              max={d.max}
              error={errors?.[`doc_${d.key}`]}
            />
          </div>
        ))}
      </div>
    </Section>
  );
}
