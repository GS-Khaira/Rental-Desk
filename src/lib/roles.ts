import type { Role } from "./types";

/** One place that describes each role, used by the Users page, forms and access checks. */
export const ROLES: Role[] = ["admin", "manager", "tenant"];

export const ROLE_INFO: Record<Role, { label: string; plural: string; summary: string; can: string[]; cannot: string[] }> = {
  admin: {
    label: "Admin",
    plural: "Admins",
    summary: "Sees everything and manages who can use the app.",
    can: ["See every manager's owners, units, renters and history", "Answer any tenant request", "Add users, change roles, reset passwords, switch access off", "Move an owner and their units to another manager"],
    cannot: [],
  },
  manager: {
    label: "Property manager",
    plural: "Property managers",
    summary: "Sees and manages only their own listings and renters.",
    can: ["Add and edit their own owners, properties, units and renters", "Match their renters to their units", "Answer requests from their tenants"],
    cannot: ["See other managers' records", "Manage users"],
  },
  tenant: {
    label: "Tenant",
    plural: "Tenants",
    summary: "Sees the place they rent now and can send requests.",
    can: ["See their current address, rent and what's included", "See their property manager's contact details", "Send a request and read replies"],
    cannot: ["See any other unit, renter or owner"],
  },
};

export const isStaffRole = (r: Role | null | undefined) => r === "admin" || r === "manager";

export const REQUEST_CATEGORIES = ["Maintenance", "Rent or payment", "Lease", "Other"] as const;
export const REQUEST_STATUSES = ["Open", "In progress", "Resolved"] as const;

export const initials = (name: string | null | undefined, email?: string | null) => {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
};
