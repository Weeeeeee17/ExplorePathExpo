import {
  distanceMeters,
  estimatedTotalMinutes,
  estimatedWalkingMinutes,
  searchRadiusMeters,
} from '../domain/geo';
import { Destination, ExplorationTheme, GeoPoint } from '../domain/types';

const endpoint = 'https://overpass-api.de/api/interpreter';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function queryFor(origin: GeoPoint, radius: number) {
  const around = `(around:${radius},${origin.latitude},${origin.longitude})`;
  return `[out:json][timeout:18];(
    nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream|marketplace)$"]${around};
    nwr["leisure"~"^(park|garden|nature_reserve)$"]${around};
    nwr["natural"~"^(wood|water|peak|spring)$"]${around};
    nwr["tourism"~"^(viewpoint|artwork|attraction|museum)$"]${around};
    nwr["historic"]${around};
    nwr["man_made"~"^(tower|lighthouse|obelisk)$"]${around};
  );out center tags;`;
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

function hintFor(theme: Exclude<ExplorationTheme, 'surprise'>, tags: Record<string, string>) {
  if (theme === 'food') {
    if (tags.amenity === 'cafe') return '一個適合停下來聞聞香氣的小店';
    if (tags.amenity === 'marketplace') return '日常街區裡有食物與人聲的地方';
    return '附近有人會停下來吃點東西的地方';
  }
  if (theme === 'nature') {
    if (tags.tourism === 'viewpoint') return '視野可能會突然打開的地方';
    if (tags.natural === 'water') return '靠近水與戶外聲音的地方';
    return '有綠意、空氣與停留空間的地方';
  }
  if (tags.historic) return '留著時間痕跡與城市故事的地方';
  if (tags.tourism === 'artwork') return '藏著公共藝術或造型細節的地方';
  return '值得抬頭看看線條與空間的地方';
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
    const body = new URLSearchParams({ data: queryFor(origin, searchRadiusMeters(maxDurationMinutes)) });
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
      const latitude = element.lat ?? element.center?.lat;
      const longitude = element.lon ?? element.center?.lon;
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
      const straightLine = Math.round(distanceMeters(origin, { latitude, longitude }));
      const totalMinutes = estimatedTotalMinutes(straightLine);
      if (straightLine < 150 || totalMinutes > maxDurationMinutes) continue;
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
        environmentHint: hintFor(itemTheme, tags),
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
