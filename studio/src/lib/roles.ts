export const ROLES = ["pending", "annotator", "curator", "viewer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export function isApproved(role: Role | null | undefined) {
  return !!role && role !== "pending";
}
