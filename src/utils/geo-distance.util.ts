/**
 * Geographic distance utilities using the Haversine formula.
 * Computes "as the crow flies" distance between two lat/lng points.
 */

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

/**
 * Calculate the Haversine distance between two geographic coordinates.
 * @returns Distance in kilometers.
 */
export function haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
}

/**
 * Check if a customer location is within a service area's coverage circle.
 */
export function isWithinServiceArea(
    customerLat: number,
    customerLng: number,
    area: {
        latitude: number | null;
        longitude: number | null;
        radiusKm: number;
    }
): boolean {
    if (area.latitude === null || area.longitude === null) {
        // Area has no coordinates set — allow by default (backward compatibility)
        return true;
    }

    const distance = haversineDistance(
        customerLat,
        customerLng,
        area.latitude,
        area.longitude
    );

    return distance <= area.radiusKm;
}

/**
 * Find the nearest service area from a list, returning the distance.
 */
export function findNearestArea(
    customerLat: number,
    customerLng: number,
    areas: Array<{
        id: string;
        latitude: number | null;
        longitude: number | null;
        radiusKm: number;
    }>
): { areaId: string; distance: number; isWithin: boolean } | null {
    if (areas.length === 0) return null;

    let nearest: { areaId: string; distance: number; isWithin: boolean } | null = null;

    for (const area of areas) {
        if (area.latitude === null || area.longitude === null) {
            // No coordinates — treat as always within (backward compatibility)
            if (!nearest || nearest.distance > 0) {
                nearest = { areaId: area.id, distance: 0, isWithin: true };
            }
            continue;
        }

        const distance = haversineDistance(
            customerLat,
            customerLng,
            area.latitude,
            area.longitude
        );
        const isWithin = distance <= area.radiusKm;

        if (!nearest || distance < nearest.distance) {
            nearest = { areaId: area.id, distance: Math.round(distance * 100) / 100, isWithin };
        }
    }

    return nearest;
}

/**
 * Check if a customer location is within ANY of the provider's service areas.
 */
export function isWithinAnyServiceArea(
    customerLat: number,
    customerLng: number,
    areas: Array<{
        latitude: number | null;
        longitude: number | null;
        radiusKm: number;
    }>
): boolean {
    if (areas.length === 0) return true; // No areas configured — allow (backward compat)

    return areas.some((area) =>
        isWithinServiceArea(customerLat, customerLng, area)
    );
}
