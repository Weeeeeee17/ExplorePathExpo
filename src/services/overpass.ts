import {
  distanceMeters,
  estimatedTotalMinutes,
  estimatedWalkingMinutes,
  searchRadiusMeters,
} from '../domain/geo';
import { Destination, ExplorationTheme, GeoPoint } from '../domain/types';

const endpoint = 'https://overpass-api.de/api/interpreter';

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{ geometry?: Array<{ lat: number; lon: number }> }>;
  tags?: Record<string, string>;
}

export function buildOverpassQuery(origin: GeoPoint, radius: number) {
  const around = `(around:${radius},${origin.latitude},${origin.longitude})`;
  return `[out:json][timeout:18];(
    nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream|marketplace)$"]${around};
    nwr["leisure"~"^(park|garden|nature_reserve)$"]${around};
    nwr["natural"~"^(wood|water|peak|spring)$"]${around};
    nwr["tourism"~"^(viewpoint|artwork|attraction|museum)$"]${around};
    nwr["historic"]${around};
    nwr["man_made"~"^(tower|lighthouse|obelisk)$"]${around};
  );out body geom;`;
}

function midpointOfBounds(bounds: NonNullable<OverpassElement['bounds']>): GeoPoint {
  return {
    latitude: (bounds.minlat + bounds.maxlat) / 2,
    longitude: (bounds.minlon + bounds.maxlon) / 2,
  };
}

function geometryPoints(element: OverpassElement): GeoPoint[] {
  return [
    ...(element.geometry ?? []),
    ...(element.members ?? []).flatMap((member) => member.geometry ?? []),
  ]
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))
    .map((point) => ({ latitude: point.lat, longitude: point.lon }));
}

export function displayPointFor(element: OverpassElement): GeoPoint | null {
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    return { latitude: element.lat as number, longitude: element.lon as number };
  }
  if (Number.isFinite(element.center?.lat) && Number.isFinite(element.center?.lon)) {
    return { latitude: element.center!.lat, longitude: element.center!.lon };
  }
  if (element.bounds) return midpointOfBounds(element.bounds);

  const points = geometryPoints(element);
  if (points.length === 0) return null;
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  return {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
  };
}

function themeFor(tags: Record<string, string>): Exclude<ExplorationTheme, 'surprise'> | null {
  if (/^(restaurant|cafe|fast_food|food_court|ice_cream|marketplace)$/.test(tags.amenity ?? '')) {
    return 'food';
  }
  if (
    /^(park|garden|nature_reserve)$/.test(tags.leisure ?? '') ||
    /^(wood|water|peak|spring)$/.test(tags.natural ?? '') ||
    tags.tourism === 'viewpoint'
  ) {
    return 'nature';
  }
  if (tags.historic || /^(artwork|attraction|museum)$/.test(tags.tourism ?? '') || tags.man_made) {
    return 'architecture';
  }
  return null;
}

function hintFor(
  theme: Exclude<ExplorationTheme, 'surprise'>,
  tags: Record<string, string>,
): { text: string; source: 'openstreetmap' | 'fallback' } {
  if (theme === 'food') {
    if (tags.amenity === 'cafe') return { text: '留意一個與咖啡、香氣和短暫停留有關的地方', source: 'openstreetmap' };
    if (tags.amenity === 'marketplace') return { text: '留意一個聚集食物、攤位或日常人聲的地方', source: 'openstreetmap' };
    if (tags.cuisine) return { text: `它和「${tags.cuisine.replaceAll('_', ' ')}」類型的飲食有關`, source: 'openstreetmap' };
    return { text: '留意附近讓人停下來吃點東西的地方', source: 'fallback' };
  }
  if (theme === 'nature') {
    if (tags.tourism === 'viewpoint') return { text: '它和視野打開、能停下觀察遠方有關', source: 'openstreetmap' };
    if (tags.natural === 'water') return { text: '留意水面、流動聲音或較開闊的空間', source: 'openstreetmap' };
    if (tags.leisure === 'park') return { text: '它是一處能在綠意和公共空間中停留的地方', source: 'openstreetmap' };
    if (tags.leisure === 'garden') return { text: '它和被整理、照顧過的植物景觀有關', source: 'openstreetmap' };
    return { text: '留意綠意、空氣與可安全停留的公共空間', source: 'fallback' };
  }
  if (tags.historic) return { text: '它留著時間痕跡，可能和地方歷史或城市記憶有關', source: 'openstreetmap' };
  if (tags.tourism === 'artwork') return { text: '留意公共藝術、造型或材質形成的細節', source: 'openstreetmap' };
  if (tags.tourism === 'museum') return { text: '它和收藏、展示或地方文化有關', source: 'openstreetmap' };
  if (tags.man_made === 'tower') return { text: '抬頭尋找一個在街區輪廓中較突出的垂直結構', source: 'openstreetmap' };
  return { text: '留意值得抬頭觀察的線條、材料與空間', source: 'fallback' };
}

function boundaryPoints(element: OverpassElement): GeoPoint[] {
  const points = geometryPoints(element);
  if (points.length > 0) return points;
  const bounds = element.bounds;
  if (!bounds) return [];
  return [
    { latitude: bounds.minlat, longitude: bounds.minlon },
    { latitude: bounds.minlat, longitude: bounds.maxlon },
    { latitude: bounds.maxlat, longitude: bounds.minlon },
    { latitude: bounds.maxlat, longitude: bounds.maxlon },
  ];
}

function arrivalPointFor(element: OverpassElement, origin: GeoPoint, fallback: GeoPoint) {
  if (element.type === 'node') return { point: fallback, kind: 'point' as const };
  const points = boundaryPoints(element);
  if (points.length < 3) return { point: fallback, kind: 'point' as const };
  const point = points.reduce((closest, candidate) =>
    distanceMeters(origin, candidate) < distanceMeters(origin, closest) ? candidate : closest,
  );
  return { point, kind: 'boundary' as const };
}

export class OverpassServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OverpassServiceError';
  }
}

export async function searchNearbyDestinations(
  origin: GeoPoint,
  maxDurationMinutes: number,
): Promise<Destination[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22_000);
  try {
    const body = new URLSearchParams({
      data: buildOverpassQuery(origin, searchRadiusMeters(maxDurationMinutes)),
    });
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString(),
      signal: controller.signal,
    });
    if (!response.ok) throw new OverpassServiceError(`OpenStreetMap 服務回傳 ${response.status}`);
    const payload = (await response.json()) as { elements?: OverpassElement[] };
    const seen = new Set<string>();
    const results: Destination[] = [];

    for (const element of payload.elements ?? []) {
      const tags = element.tags ?? {};
      const displayPoint = displayPointFor(element);
      const latitude = displayPoint?.latitude;
      const longitude = displayPoint?.longitude;
      const itemTheme = themeFor(tags);
      const name = tags.name?.trim();
      if (
        latitude === undefined ||
        longitude === undefined ||
        !itemTheme ||
        !name ||
        tags.access === 'private' ||
        tags.access === 'no'
      ) continue;
      const id = `osm-${element.type}-${element.id}`;
      const nameKey = `${name}-${latitude.toFixed(4)}-${longitude.toFixed(4)}`;
      if (seen.has(nameKey)) continue;
      const arrival = arrivalPointFor(element, origin, { latitude, longitude });
      const straightLine = Math.round(distanceMeters(origin, arrival.point));
      const totalMinutes = estimatedTotalMinutes(straightLine);
      if (straightLine < 150 || totalMinutes > maxDurationMinutes) continue;
      const hint = hintFor(itemTheme, tags);
      seen.add(nameKey);
      results.push({
        id,
        internalName: name,
        theme: itemTheme,
        walkingMinutes: estimatedWalkingMinutes(straightLine),
        totalMinutes,
        distanceMeters: straightLine,
        latitude,
        longitude,
        arrivalLatitude: arrival.point.latitude,
        arrivalLongitude: arrival.point.longitude,
        arrivalKind: arrival.kind,
        environmentHint: hint.text,
        hintSource: hint.source,
        source: 'openstreetmap',
      });
    }
    return results.sort((a, b) => a.totalMinutes - b.totalMinutes || a.id.localeCompare(b.id));
  } catch (error) {
    if (error instanceof OverpassServiceError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OverpassServiceError('OpenStreetMap 搜尋逾時，請稍後重試。');
    }
    throw new OverpassServiceError('無法連線到 OpenStreetMap 搜尋服務。');
  } finally {
    clearTimeout(timeout);
  }
}
