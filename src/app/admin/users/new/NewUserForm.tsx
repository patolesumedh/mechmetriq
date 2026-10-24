"use client";

import { useState } from "react";
import { createUserAction } from "../actions";
import { Field, inputClass } from "../_components/fields";

export function NewUserForm() {
  const [role, setRole] = useState("buyer");

  return (
    <form action={createUserAction} className="space-y-4 p-5 text-[13px]">
      <Field label="Role" htmlFor="role">
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputClass}
        >
          <option value="buyer">Buyer</option>
          <option value="vendor">Vendor</option>
          <option value="admin">Admin</option>
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Full name" htmlFor="full_name">
          <input id="full_name" name="full_name" required maxLength={120} className={inputClass} />
        </Field>
        <Field label="Email" htmlFor="email" hint="They'll get a link here to set their password.">
          <input id="email" name="email" type="email" required maxLength={200} className={inputClass} />
        </Field>
        <Field label="Mobile (optional)" htmlFor="phone" hint="10-digit Indian mobile number.">
          <input id="phone" name="phone" inputMode="tel" maxLength={20} className={inputClass} />
        </Field>
      </div>

      {role === "vendor" && (
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-grid bg-plane p-4">
          <Field label="Vendor type" htmlFor="vendor_type">
            <select id="vendor_type" name="vendor_type" required defaultValue="fabrication" className={inputClass}>
              <option value="fabrication">Fabrication / machining</option>
              <option value="raw_material">Raw material supplier</option>
            </select>
          </Field>
          <Field label="Company name" htmlFor="company_name">
            <input id="company_name" name="company_name" required maxLength={200} className={inputClass} />
          </Field>
          <Field label="GSTIN (optional)" htmlFor="gstin" hint="Otherwise the vendor adds it during KYC.">
            <input id="gstin" name="gstin" maxLength={15} className={inputClass + " uppercase"} />
          </Field>
          <p className="col-span-2 text-[12px] text-ink-2">
            The vendor still completes KYC after first sign-in, and you approve it under Vendors.
          </p>
        </div>
      )}

      {role === "admin" && (
        <p className="rounded-lg bg-warn-bg px-3 py-2 text-[12.5px] text-[#8a5a00]">
          Admins have full access to every buyer, vendor and order. They must set up an authenticator
          app the first time they sign in.
        </p>
      )}

      <button type="submit" className="rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-bold text-white">
        Create user &amp; send invite
      </button>
    </form>
  );
}
