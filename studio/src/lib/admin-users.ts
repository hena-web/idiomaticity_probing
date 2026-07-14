import { listUsers as listRepositoryUsers, setUserRole } from "@/data/repository";
import type { Role } from "@/lib/roles";

export interface AdminUserRow {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: Role;
}

export async function listUsers(): Promise<AdminUserRow[]> {
  const rows = await listRepositoryUsers();
  return rows.map((row) => ({
    uid: String(row.uid ?? ""),
    email: (row.email as string | null | undefined) ?? null,
    displayName: (row.displayName as string | null | undefined) ?? null,
    photoURL: (row.photoURL as string | null | undefined) ?? null,
    role: (row.role as Role | undefined) ?? "pending",
  }));
}

export { setUserRole };
