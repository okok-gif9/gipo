export const backgroundAssets = {
  none: undefined,
  "cats-dark": "/manus-storage/gipo-cats-dark_d1496804.jpg",
  "doodles-gradient": "/manus-storage/gipo-doodles-gradient_d1ef08a0.jpg",
} as const;

export type Locale = "fa" | "en";
export type BackgroundPreference = keyof typeof backgroundAssets;
export type AccountStatus = "active" | "deletion_pending";

export type GipoProfile = {
  id: string;
  display_name: string | null;
  public_handle: string | null;
  onboarding_completed_at: string | null;
  age_gate_acknowledged_at: string | null;
  locale: Locale;
  theme_preference: "system" | "light" | "dark";
  background_preference: BackgroundPreference;
  persona_name: string | null;
  persona_pronouns: string | null;
  persona_description: string | null;
  persona_enabled_by_default: boolean;
  profile_visibility: "private" | "public";
  account_status: AccountStatus;
  deletion_effective_at: string | null;
};

export const normalizeHandle = (value: string) => value.trim().toLowerCase();
export const isValidHandle = (value: string) => /^[a-z0-9_]{3,24}$/.test(normalizeHandle(value));
export const passwordRequirements = (value: string) => ({
  length: value.length >= 12,
  lower: /[a-z]/.test(value),
  upper: /[A-Z]/.test(value),
  digit: /\d/.test(value),
  symbol: /[^A-Za-z0-9]/.test(value),
});
export const isStrongPassword = (value: string) => Object.values(passwordRequirements(value)).every(Boolean);

const characters = {
  lower: "abcdefghijkmnopqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  digit: "23456789",
  symbol: "!@#$%^&*-_=+",
};
const randomFrom = (value: string) => value[crypto.getRandomValues(new Uint32Array(1))[0] % value.length] ?? "";

export const createStrongPassword = () => {
  const required = [randomFrom(characters.lower), randomFrom(characters.upper), randomFrom(characters.digit), randomFrom(characters.symbol)];
  const source = Object.values(characters).join("");
  while (required.length < 18) required.push(randomFrom(source));
  for (let index = required.length - 1; index > 0; index -= 1) {
    const target = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [required[index], required[target]] = [required[target] ?? "", required[index] ?? ""];
  }
  return required.join("");
};

export const profileColumns = "id,display_name,public_handle,onboarding_completed_at,age_gate_acknowledged_at,locale,theme_preference,background_preference,persona_name,persona_pronouns,persona_description,persona_enabled_by_default,profile_visibility,account_status,deletion_effective_at";
