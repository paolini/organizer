export const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  read: { label: "Lettura", description: "Vedere file e tag, scaricare" },
  write: { label: "Scrittura", description: "Modificare tag, caricare, spostare, rinominare, eliminare" },
  admin: { label: "Admin", description: "Gestire gli utenti" },
};

export const PERMISSION_KEYS = ["read", "write", "admin"] as const;

/** Password casuale leggibile (senza caratteri ambigui come 0/O, 1/l) */
export function generatePassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}
