/**
 * ShipMova — checks on an inspection's photos (Day 4). Pure.
 *
 * Every required photo (VIN plate, odometer, title) must carry the phone's
 * location at capture, all photos must be within 1 km and 3 hours of each
 * other, and taken after the inspection was assigned. The car's listing has
 * only city/state, so the admin compares the map link with it by eye.
 */
export const REQUIRED_PHOTO_KINDS = ["vin", "odometer", "title"] as const;
export type PhotoKind = (typeof REQUIRED_PHOTO_KINDS)[number] | "car";

export const MAX_SPREAD_METERS = 1000;
export const MAX_SPREAD_HOURS = 3;

export type InspectionPhoto = {
  kind: PhotoKind;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  capturedAt: string | null;
};

export type PhotoFlag =
  | "missing_vin_photo"
  | "missing_odometer_photo"
  | "missing_title_photo"
  | "photo_without_location"
  | "photos_far_apart"
  | "photos_hours_apart"
  | "photo_before_assignment"
  | "low_location_accuracy";

/** Great-circle distance in meters. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function photoFlags(photos: InspectionPhoto[], assignedAt: string): PhotoFlag[] {
  const flags = new Set<PhotoFlag>();
  for (const k of REQUIRED_PHOTO_KINDS) {
    if (!photos.some((p) => p.kind === k)) flags.add(`missing_${k}_photo` as PhotoFlag);
  }
  const located = photos.filter((p) => p.latitude != null && p.longitude != null);
  if (located.length < photos.length) flags.add("photo_without_location");
  if (photos.some((p) => p.accuracyM != null && p.accuracyM > 200)) flags.add("low_location_accuracy");
  for (let i = 0; i < located.length; i++) {
    for (let j = i + 1; j < located.length; j++) {
      const d = distanceMeters(
        { lat: located[i].latitude!, lng: located[i].longitude! },
        { lat: located[j].latitude!, lng: located[j].longitude! },
      );
      if (d > MAX_SPREAD_METERS) flags.add("photos_far_apart");
    }
  }
  const times = photos.map((p) => (p.capturedAt ? Date.parse(p.capturedAt) : NaN)).filter((t) => !Number.isNaN(t));
  if (times.length > 1 && Math.max(...times) - Math.min(...times) > MAX_SPREAD_HOURS * 3_600_000) flags.add("photos_hours_apart");
  if (times.some((t) => t < Date.parse(assignedAt))) flags.add("photo_before_assignment");
  return [...flags];
}

export const PHOTO_FLAG_LABEL: Record<PhotoFlag, string> = {
  missing_vin_photo: "No VIN plate photo",
  missing_odometer_photo: "No odometer photo",
  missing_title_photo: "No title photo",
  photo_without_location: "A photo has no location",
  photos_far_apart: `Photos taken more than ${MAX_SPREAD_METERS / 1000} km apart`,
  photos_hours_apart: `Photos taken more than ${MAX_SPREAD_HOURS} hours apart`,
  photo_before_assignment: "A photo is dated before the inspection was assigned",
  low_location_accuracy: "Location accuracy worse than 200 m",
};
