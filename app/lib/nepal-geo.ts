// ─── Nepal geo data: loaders, validators, formatter ───────────────
// Loads the hierarchical nepal-geo.json (Province → Districts → Local levels)
// and provides server-safe validation + a human-readable address composer.

import provincesData from "@/app/data/nepal-geo.json";

export type LocalLevel = {
  id: number;
  name: string;
  type: string;
  totalWard?: number;
};

export type District = {
  id: number;
  name: string;
  localLevels: LocalLevel[];
};

export type Province = {
  id: number;
  name: string;
  districts: District[];
};

const PROVINCES: Province[] = provincesData as Province[];

// ─── Lookups ──────────────────────────────────────────────────────

export function getProvinces(): Province[] {
  return PROVINCES;
}

export function getProvince(provinceId: number): Province | undefined {
  return PROVINCES.find((p) => p.id === provinceId);
}

export function getDistrict(provinceId: number, districtId: number): District | undefined {
  const province = getProvince(provinceId);
  return province?.districts.find((d) => d.id === districtId);
}

export function getLocalLevel(
  provinceId: number,
  districtId: number,
  localLevelId: number,
): LocalLevel | undefined {
  const district = getDistrict(provinceId, districtId);
  return district?.localLevels.find((l) => l.id === localLevelId);
}

// ─── Validation ───────────────────────────────────────────────────

export interface AddressInput {
  provinceId?: number | null;
  provinceName?: string | null;
  districtId?: number | null;
  districtName?: string | null;
  localLevelId?: number | null;
  localLevelName?: string | null;
  localLevelType?: string | null;
  ward?: number | null;
  tole?: string | null;
}

export interface ValidatedAddress {
  provinceId: number;
  provinceName: string;
  districtId: number;
  districtName: string;
  localLevelId: number;
  localLevelName: string;
  localLevelType: string;
  ward: number | null;
  tole: string | null;
}

/**
 * Validates a structured address against the geo dataset.
 * Returns the canonical names (from the dataset) to prevent spoofing.
 * Throws an Error with a user-facing message if any field is invalid.
 */
export function validateAddress(input: AddressInput): ValidatedAddress {
  const { provinceId, districtId, localLevelId } = input;

  if (!provinceId) {
    throw new Error("Please select a province.");
  }
  const province = getProvince(provinceId);
  if (!province) {
    throw new Error("The selected province is not valid.");
  }

  if (!districtId) {
    throw new Error("Please select a district.");
  }
  const district = province.districts.find((d) => d.id === districtId);
  if (!district) {
    throw new Error("The selected district is not in the chosen province.");
  }

  if (!localLevelId) {
    throw new Error("Please select a local level (municipality/rural municipality).");
  }
  const localLevel = district.localLevels.find((l) => l.id === localLevelId);
  if (!localLevel) {
    throw new Error("The selected local level is not in the chosen district.");
  }

  const ward = input.ward ?? null;
  const maxWard = localLevel.totalWard ?? 32;
  if (ward !== null && (ward < 1 || ward > maxWard)) {
    throw new Error(`Ward number must be between 1 and ${maxWard} for ${localLevel.name}.`);
  }

  const tole = input.tole?.trim() || null;

  return {
    provinceId: province.id,
    provinceName: province.name,
    districtId: district.id,
    districtName: district.name,
    localLevelId: localLevel.id,
    localLevelName: localLevel.name,
    localLevelType: localLevel.type,
    ward,
    tole,
  };
}

/**
 * Composes a human-readable address string from validated components.
 * Format: "Tole, Ward X, LocalLevel Type, District, Province"
 */
export function formatAddress(addr: ValidatedAddress): string {
  const parts: string[] = [];

  if (addr.tole) parts.push(addr.tole);
  if (addr.ward) parts.push(`Ward ${addr.ward}`);
  parts.push(`${addr.localLevelName} ${addr.localLevelType}`);
  parts.push(addr.districtName);
  parts.push(addr.provinceName);

  return parts.join(", ");
}

/**
 * Formats a partial address (for display when not all fields are set).
 */
export function formatAddressPartial(addr: AddressInput): string | null {
  const parts: string[] = [];

  if (addr.tole?.trim()) parts.push(addr.tole.trim());
  if (addr.ward) parts.push(`Ward ${addr.ward}`);
  if (addr.localLevelName) parts.push(`${addr.localLevelName} ${addr.localLevelType ?? ""}`.trim());
  if (addr.districtName) parts.push(addr.districtName);
  if (addr.provinceName) parts.push(addr.provinceName);

  return parts.length > 0 ? parts.join(", ") : null;
}