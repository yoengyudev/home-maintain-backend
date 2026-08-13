import { CAMBODIA_LOCATIONS } from "../../data/cambodia.locations";
import { logger } from "../../utils/logger.util";

const PROVINCES_URL =
    "https://data.mef.gov.kh/api/v1/public-datasets/pd_66a8603700604c000123e144/json";
const DISTRICTS_URL =
    "https://data.mef.gov.kh/api/v1/public-datasets/pd_66a8603800604c000123e145/json";

const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const PAGE_SIZE = 200;

type MefProvinceRow = {
    province_code?: string;
    province_kh?: string;
    province_en?: string;
};

type MefDistrictRow = {
    province_code?: string;
    district_code?: string;
    district_kh?: string;
    district_en?: string;
};

type MefPage<T> = {
    items?: T[];
    data?: T[];
    total_pages?: number;
    total_items?: number;
    page?: number;
    page_size?: number;
};

export type VendorLocationDistrict = {
    code: string;
    nameEn: string;
    nameKm: string;
};

export type VendorLocationProvince = {
    code: string;
    nameEn: string;
    nameKm: string;
    districts: VendorLocationDistrict[];
};

type LocationsPayload = {
    provinces: VendorLocationProvince[];
    source: "mef" | "fallback";
};

let cachedLocations: LocationsPayload | null = null;
let cachedAt = 0;
let inflight: Promise<LocationsPayload> | null = null;

async function fetchMefPage<T>(url: string, page: number): Promise<MefPage<T>> {
    const endpoint = `${url}?page=${page}&page_size=${PAGE_SIZE}`;
    const response = await fetch(endpoint, {
        method: "GET",
        headers: {
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        throw new Error(`MEF locations request failed (${response.status})`);
    }

    return (await response.json()) as MefPage<T>;
}

async function fetchAllMefItems<T>(url: string): Promise<T[]> {
    const first = await fetchMefPage<T>(url, 1);
    const rows = [...(first.items || first.data || [])];
    const totalPages = Math.max(1, Number(first.total_pages || 1));

    for (let page = 2; page <= totalPages; page += 1) {
        const next = await fetchMefPage<T>(url, page);
        rows.push(...(next.items || next.data || []));
    }

    return rows;
}

function mapStaticFallback(): LocationsPayload {
    return {
        source: "fallback",
        provinces: CAMBODIA_LOCATIONS.map((province) => ({
            code: province.code,
            nameEn: province.nameEn,
            nameKm: province.nameKm,
            districts: province.districts.map((district) => ({
                code: district.code,
                nameEn: district.nameEn,
                nameKm: district.nameKm,
            })),
        })),
    };
}

function mapMefLocations(
    provinces: MefProvinceRow[],
    districts: MefDistrictRow[]
): LocationsPayload {
    const districtsByProvince = new Map<string, VendorLocationDistrict[]>();

    for (const row of districts) {
        const provinceCode = String(row.province_code || "").trim();
        const districtCode = String(row.district_code || "").trim();
        const nameEn = String(row.district_en || "").trim();
        const nameKm = String(row.district_kh || "").trim();
        if (!provinceCode || !districtCode || (!nameEn && !nameKm)) continue;

        const list = districtsByProvince.get(provinceCode) || [];
        list.push({
            code: districtCode,
            nameEn: nameEn || nameKm,
            nameKm: nameKm || nameEn,
        });
        districtsByProvince.set(provinceCode, list);
    }

    const mappedProvinces = provinces
        .map((row) => {
            const code = String(row.province_code || "").trim();
            const nameEn = String(row.province_en || "").trim();
            const nameKm = String(row.province_kh || "").trim();
            if (!code || (!nameEn && !nameKm)) return null;

            const provinceDistricts = [...(districtsByProvince.get(code) || [])].sort((a, b) =>
                a.nameEn.localeCompare(b.nameEn)
            );

            return {
                code,
                nameEn: nameEn || nameKm,
                nameKm: nameKm || nameEn,
                districts: provinceDistricts,
            } satisfies VendorLocationProvince;
        })
        .filter((item): item is VendorLocationProvince => Boolean(item))
        .sort((a, b) => a.nameEn.localeCompare(b.nameEn));

    if (mappedProvinces.length === 0) {
        throw new Error("MEF returned no provinces");
    }

    return {
        source: "mef",
        provinces: mappedProvinces,
    };
}

async function loadFromMef(): Promise<LocationsPayload> {
    const [provinces, districts] = await Promise.all([
        fetchAllMefItems<MefProvinceRow>(PROVINCES_URL),
        fetchAllMefItems<MefDistrictRow>(DISTRICTS_URL),
    ]);
    return mapMefLocations(provinces, districts);
}

export class VendorLocationsService {
    static async getLocations(): Promise<LocationsPayload> {
        const now = Date.now();
        if (cachedLocations && now - cachedAt < CACHE_TTL_MS) {
            return cachedLocations;
        }

        if (inflight) {
            return inflight;
        }

        inflight = (async () => {
            try {
                const payload = await loadFromMef();
                cachedLocations = payload;
                cachedAt = Date.now();
                return payload;
            } catch (error) {
                logger.error("Failed to load MEF Cambodia locations", error);
                if (cachedLocations) {
                    return cachedLocations;
                }
                return mapStaticFallback();
            } finally {
                inflight = null;
            }
        })();

        return inflight;
    }
}
