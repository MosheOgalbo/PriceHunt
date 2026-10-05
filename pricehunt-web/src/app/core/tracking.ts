import { findPlace } from './places';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Port positions, so the live map places the real origin and destination. */
const COORDS: Record<string, LatLng> = {
  ILHFA: { lat: 32.82, lng: 34.99 }, ILASH: { lat: 31.82, lng: 34.64 }, ILTLV: { lat: 32.08, lng: 34.78 },
  ILETH: { lat: 29.55, lng: 34.95 }, NLRTM: { lat: 51.95, lng: 4.14 }, NLAMS: { lat: 52.37, lng: 4.9 },
  DEHAM: { lat: 53.55, lng: 9.99 }, DEBRV: { lat: 53.54, lng: 8.58 }, BEANR: { lat: 51.22, lng: 4.4 },
  GBFXT: { lat: 51.96, lng: 1.35 }, GBSOU: { lat: 50.9, lng: -1.4 }, GBLON: { lat: 51.51, lng: -0.13 },
  FRLEH: { lat: 49.49, lng: 0.11 }, FRMRS: { lat: 43.3, lng: 5.37 }, ESBCN: { lat: 41.39, lng: 2.17 },
  ESVLC: { lat: 39.47, lng: -0.38 }, ESALG: { lat: 36.13, lng: -5.45 }, ITGOA: { lat: 44.41, lng: 8.93 },
  ITTRS: { lat: 45.65, lng: 13.78 }, GRPIR: { lat: 37.94, lng: 23.65 }, TRIST: { lat: 41.01, lng: 28.98 },
  TRMER: { lat: 36.8, lng: 34.63 }, PLGDN: { lat: 54.35, lng: 18.65 }, SEGOT: { lat: 57.71, lng: 11.97 },
  DKAAR: { lat: 56.16, lng: 10.21 }, NOOSL: { lat: 59.91, lng: 10.75 }, FIHEL: { lat: 60.17, lng: 24.94 },
  RULED: { lat: 59.93, lng: 30.32 }, RUNVS: { lat: 44.72, lng: 37.77 }, UAODS: { lat: 46.48, lng: 30.73 },
  ROCND: { lat: 44.17, lng: 28.63 }, SIKOP: { lat: 45.55, lng: 13.73 }, EGALY: { lat: 31.2, lng: 29.92 },
  EGPSD: { lat: 31.26, lng: 32.3 }, LBBEY: { lat: 33.89, lng: 35.5 }, CYLMS: { lat: 34.68, lng: 33.04 },
  JOAQJ: { lat: 29.53, lng: 35 }, SAJED: { lat: 21.49, lng: 39.17 }, SADMM: { lat: 26.42, lng: 50.1 },
  AEJEA: { lat: 25.01, lng: 55.06 }, AEAUH: { lat: 24.45, lng: 54.37 }, OMSLL: { lat: 16.94, lng: 54.01 },
  QAHMD: { lat: 25.02, lng: 51.57 }, KWKWI: { lat: 29.38, lng: 47.98 }, INNSA: { lat: 18.95, lng: 72.95 },
  INMAA: { lat: 13.08, lng: 80.27 }, LKCMB: { lat: 6.93, lng: 79.84 }, SGSIN: { lat: 1.29, lng: 103.85 },
  MYPKG: { lat: 3, lng: 101.4 }, IDJKT: { lat: -6.21, lng: 106.85 }, THLCH: { lat: 13.08, lng: 100.88 },
  VNSGN: { lat: 10.82, lng: 106.63 }, PHMNL: { lat: 14.6, lng: 120.98 }, CNSHA: { lat: 31.23, lng: 121.47 },
  CNNGB: { lat: 29.87, lng: 121.55 }, CNTAO: { lat: 36.07, lng: 120.38 }, CNYTN: { lat: 22.57, lng: 114.27 },
  HKHKG: { lat: 22.32, lng: 114.17 }, JPYOK: { lat: 35.44, lng: 139.64 }, KRPUS: { lat: 35.18, lng: 129.08 },
  TWKHH: { lat: 22.62, lng: 120.27 }, AUSYD: { lat: -33.87, lng: 151.21 }, AUMEL: { lat: -37.81, lng: 144.96 },
  NZAKL: { lat: -36.85, lng: 174.76 }, ZACPT: { lat: -33.92, lng: 18.42 }, ZADUR: { lat: -29.86, lng: 31.02 },
  NGLOS: { lat: 6.45, lng: 3.4 }, MACAS: { lat: 33.6, lng: -7.62 }, MATNG: { lat: 35.79, lng: -5.8 },
  BRSSZ: { lat: -23.96, lng: -46.33 }, BRRIO: { lat: -22.91, lng: -43.17 }, ARBUE: { lat: -34.6, lng: -58.38 },
  CLVAP: { lat: -33.05, lng: -71.62 }, PECLL: { lat: -12.05, lng: -77.15 }, USNYC: { lat: 40.71, lng: -74.01 },
  USLAX: { lat: 33.74, lng: -118.27 }, USHOU: { lat: 29.76, lng: -95.37 }, USSEA: { lat: 47.61, lng: -122.33 },
  USORF: { lat: 36.85, lng: -76.29 }, CAVAN: { lat: 49.28, lng: -123.12 }, CAMTR: { lat: 45.5, lng: -73.57 },
  MXZLO: { lat: 19.05, lng: -104.32 }, PABLB: { lat: 8.95, lng: -79.57 }, COCTG: { lat: 10.39, lng: -75.48 },
};

export interface TrackingIds {
  waybill: string;
  shipmentId: string;
  plate: string;
  /** Stable carrier / supplier account code for this quote. */
  supplierId: string;
}

export interface MapPoint {
  x: number;
  y: number;
}

export interface RouteLayout {
  width: number;
  height: number;
  from: MapPoint;
  to: MapPoint;
  road: string;
  truck: MapPoint & { angle: number };
}

const MAP_W = 640;
const MAP_H = 280;

function hash(seed: string): number {
  let n = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    n ^= seed.charCodeAt(i);
    n = Math.imul(n, 16777619);
  }
  return n >>> 0;
}

function pad(value: number, size: number): string {
  return String(value).padStart(size, '0');
}

function pointOf(name: string, fallback: LatLng): LatLng {
  const locode = findPlace(name)?.locode;
  return (locode && COORDS[locode]) || fallback;
}

/**
 * Package ids come from the shipment seed (shared across quotes).
 * Supplier id and plate come from the carrier name (unique per supplier).
 */
export function trackingIds(seed: string, supplier = ''): TrackingIds {
  const shipment = hash(seed || 'pricehunt');
  const carrier = hash(supplier || seed || 'pricehunt');
  return {
    waybill: `WB${pad((shipment % 90000000) + 10000000, 8)}`,
    shipmentId: `SHP-${pad((shipment >>> 8) % 900000 + 100000, 6)}`,
    supplierId: supplierCode(supplier || seed),
    plate: `${pad((carrier % 90) + 10, 2)}-${pad(((carrier >>> 4) % 900) + 100, 3)}-${pad(((carrier >>> 12) % 90) + 10, 2)}`,
  };
}

/** Stable supplier / carrier code, same name → same id in every language. */
export function supplierCode(name: string): string {
  const n = hash(name || 'supplier');
  return `SC-${pad((n % 900000) + 100000, 6)}`;
}

function bezier(a: MapPoint, c: MapPoint, b: MapPoint, t: number): MapPoint {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

/** Project the two places onto a map and lay a road between them. */
export function routeLayout(fromName: string, toName: string, progress: number): RouteLayout {
  const from = pointOf(fromName, { lat: 32, lng: 35 });
  const to = pointOf(toName, { lat: 51, lng: 4 });
  const pad = 56;
  const latSpan = Math.max(Math.abs(from.lat - to.lat), 6);
  const lngSpan = Math.max(Math.abs(from.lng - to.lng), 6);
  const midLat = (from.lat + to.lat) / 2;
  const midLng = (from.lng + to.lng) / 2;
  const xOf = (lng: number) => pad + ((lng - (midLng - lngSpan / 2)) / lngSpan) * (MAP_W - pad * 2);
  const yOf = (lat: number) => pad + (((midLat + latSpan / 2) - lat) / latSpan) * (MAP_H - pad * 2);
  const a = { x: xOf(from.lng), y: yOf(from.lat) };
  const b = { x: xOf(to.lng), y: yOf(to.lat) };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = Math.min(72, len * 0.28);
  const c = { x: (a.x + b.x) / 2 + (-dy / len) * bend, y: (a.y + b.y) / 2 + (dx / len) * bend };
  const t = Math.min(1, Math.max(0, progress));
  const truck = bezier(a, c, b, t);
  const ahead = bezier(a, c, b, Math.min(1, t + 0.04));
  const angle = Math.atan2(ahead.y - truck.y, ahead.x - truck.x) * (180 / Math.PI);
  return {
    width: MAP_W,
    height: MAP_H,
    from: a,
    to: b,
    road: `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${c.x.toFixed(1)} ${c.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
    truck: { ...truck, angle },
  };
}
