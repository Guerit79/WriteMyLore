import * as L from 'leaflet';
import { BORDER_MIN_POINTS, MapBorder, MapPoint } from '../../../core/models/map-border';

/** Tracé en cours (dessin ou modification d'une frontière), affiché avec ses poignées. */
export interface BorderSketch {
  points: readonly MapPoint[];
  /** `false` pendant le dessin (sommets ajoutés au clic), `true` une fois le polygone fermé. */
  closed: boolean;
  color: string;
}

export interface SketchVertexChange {
  index: number;
  point: MapPoint;
}

/** Déplacement de tout le tracé, en coordonnées normalisées (fraction de l'image). */
export interface SketchTranslation {
  dx: number;
  dy: number;
}

export interface BorderLayerOptions {
  selectedId: string | null;
  /** Frontières cliquables (mode « Gérer les frontières », hors dessin). */
  selectable: boolean;
  visible: boolean;
}

interface BorderLayerEvents {
  borderSelect(id: string): void;
  vertexClick(index: number): void;
  vertexMove(change: SketchVertexChange): void;
  vertexInsert(change: SketchVertexChange): void;
  translate(translation: SketchTranslation): void;
}

/** Conversion coordonnées Leaflet ↔ coordonnées normalisées de l'image. */
interface BorderProjection {
  toLatLng(point: MapPoint): L.LatLng;
  toPoint(latlng: L.LatLng): MapPoint;
}

/**
 * Calques Leaflet dédiés (panneaux) : frontières et tracé entre l'image (400) et les marqueurs
 * des lieux (600) ; noms des royaumes au-dessus des marqueurs pour rester lisibles (ils ne
 * captent aucun clic : les marqueurs restent cliquables à travers).
 */
const PANES = {
  borders: { name: 'world-map-borders', zIndex: 450 },
  sketch: { name: 'world-map-border-sketch', zIndex: 470 },
  labels: { name: 'world-map-border-labels', zIndex: 615 },
  // Poignées au-dessus des marqueurs : elles doivent rester saisissables pendant l'édition.
  handles: { name: 'world-map-border-handles', zIndex: 640 },
} as const;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** Centre de gravité du polygone (moyenne des sommets si sa surface est nulle). */
export function polygonCentroid(points: readonly MapPoint[]): MapPoint {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area) < 1e-9) {
    const n = points.length || 1;
    return {
      x: points.reduce((sum, p) => sum + p.x, 0) / n,
      y: points.reduce((sum, p) => sum + p.y, 0) / n,
    };
  }
  return { x: cx / (3 * area), y: cy / (3 * area) };
}

/**
 * Calque des frontières de royaumes, dessiné en SVG par Leaflet dans ses propres panneaux :
 * il suit exactement le zoom et le déplacement de la carte, sans toucher à l'image ni aux lieux.
 * Hors édition, les frontières et leurs noms ne capturent aucun clic.
 */
export class BorderLayer {
  private readonly bordersGroup = L.layerGroup();
  private readonly labelsGroup = L.layerGroup();
  private readonly sketchGroup = L.layerGroup();
  private readonly bordersRenderer: L.SVG;
  private readonly sketchRenderer: L.SVG;
  /** Segment « élastique » entre le dernier sommet et le pointeur, pendant le dessin. */
  private rubberBand: L.Polyline | null = null;
  private lastVertex: L.LatLng | null = null;

  constructor(
    private readonly map: L.Map,
    private readonly projection: BorderProjection,
    private readonly events: BorderLayerEvents,
  ) {
    for (const pane of Object.values(PANES)) {
      map.createPane(pane.name).style.zIndex = String(pane.zIndex);
    }
    // Les noms des royaumes ne bloquent jamais les interactions avec la carte.
    map.getPane(PANES.labels.name)!.style.pointerEvents = 'none';
    this.bordersRenderer = L.svg({ pane: PANES.borders.name });
    this.sketchRenderer = L.svg({ pane: PANES.sketch.name });
    this.bordersGroup.addTo(map);
    this.labelsGroup.addTo(map);
    this.sketchGroup.addTo(map);

    map.on('mousemove', (event: L.LeafletMouseEvent) => {
      if (this.rubberBand && this.lastVertex) {
        this.rubberBand.setLatLngs([this.lastVertex, event.latlng]);
      }
    });
    map.on('mouseout', () => this.rubberBand?.setLatLngs([]));
  }

  renderBorders(borders: readonly MapBorder[], options: BorderLayerOptions): void {
    this.bordersGroup.clearLayers();
    this.labelsGroup.clearLayers();
    if (!options.visible) {
      return;
    }
    for (const border of borders) {
      if (border.points.length < BORDER_MIN_POINTS) {
        continue;
      }
      const selected = border.id === options.selectedId;
      const polygon = L.polygon(border.points.map((point) => this.projection.toLatLng(point)), {
        renderer: this.bordersRenderer,
        color: border.color,
        weight: border.strokeWidth + (selected ? 2 : 0),
        opacity: 0.95,
        dashArray: border.strokeStyle === 'pointille' ? `${border.strokeWidth * 3} ${border.strokeWidth * 2.5}` : undefined,
        lineCap: 'round',
        lineJoin: 'round',
        fillColor: border.color,
        fillOpacity: border.fillOpacity,
        interactive: options.selectable,
        bubblingMouseEvents: false,
        className: `world-map-border${selected ? ' is-selected' : ''}`,
      });
      if (options.selectable) {
        polygon.on('click', () => this.events.borderSelect(border.id));
      }
      this.bordersGroup.addLayer(polygon);
      this.labelsGroup.addLayer(this.label(border));
    }
  }

  renderSketch(sketch: BorderSketch | null): void {
    this.sketchGroup.clearLayers();
    this.rubberBand = null;
    this.lastVertex = null;
    if (!sketch) {
      return;
    }
    const latlngs = sketch.points.map((point) => this.projection.toLatLng(point));
    const count = latlngs.length;
    const style = { renderer: this.sketchRenderer, color: sketch.color, interactive: false };

    // Aperçu : polygone fermé, ou contour ouvert + remplissage léger pendant le dessin.
    // Contour mis à jour en direct pendant qu'on fait glisser une poignée.
    let shape: (L.Layer & { setLatLngs(latlngs: L.LatLng[]): unknown }) | null = null;
    if (sketch.closed && count >= BORDER_MIN_POINTS) {
      shape = L.polygon(latlngs, { ...style, weight: 3, dashArray: '8 5', fillColor: sketch.color, fillOpacity: 0.2 });
    } else if (count >= 2) {
      if (count >= BORDER_MIN_POINTS) {
        this.sketchGroup.addLayer(L.polygon(latlngs, { ...style, stroke: false, fillColor: sketch.color, fillOpacity: 0.12 }));
      }
      shape = L.polyline(latlngs, { ...style, weight: 3, dashArray: '8 5' });
    }
    if (shape) {
      this.sketchGroup.addLayer(shape);
    }

    if (!sketch.closed) {
      this.rubberBand = L.polyline([], { ...style, weight: 2, dashArray: '3 6', opacity: 0.85 });
      this.sketchGroup.addLayer(this.rubberBand);
      this.lastVertex = latlngs.at(-1) ?? null;
    }

    latlngs.forEach((latlng, index) => {
      const closable = !sketch.closed && index === 0 && count >= BORDER_MIN_POINTS;
      const handle = this.handle(latlng, `world-map-vertex${closable ? ' is-first' : ''}`, closable ? 'Fermer le tracé ici' : `Sommet ${index + 1}`);
      handle.on('click', () => this.events.vertexClick(index));
      handle.on('drag', () => {
        latlngs[index] = handle.getLatLng();
        shape?.setLatLngs(latlngs);
      });
      handle.on('dragend', () => this.events.vertexMove({ index, point: this.projection.toPoint(handle.getLatLng()) }));
      this.sketchGroup.addLayer(handle);
    });

    if (sketch.closed && count >= BORDER_MIN_POINTS) {
      // Milieux des côtés : glisser (ou cliquer) ajoute un sommet.
      latlngs.forEach((latlng, index) => {
        const next = latlngs[(index + 1) % count];
        const middle = L.latLng((latlng.lat + next.lat) / 2, (latlng.lng + next.lng) / 2);
        const handle = this.handle(middle, 'world-map-vertex is-mid', 'Ajouter un sommet');
        const insert = () => this.events.vertexInsert({ index: index + 1, point: this.projection.toPoint(handle.getLatLng()) });
        handle.on('click', insert);
        handle.on('dragend', insert);
        this.sketchGroup.addLayer(handle);
      });

      // Poignée centrale : déplace toute la frontière.
      const center = this.projection.toLatLng(polygonCentroid(sketch.points));
      const mover = this.handle(center, 'world-map-move-handle', 'Déplacer toute la frontière', '✥');
      mover.on('drag', () => {
        const now = mover.getLatLng();
        const dLat = now.lat - center.lat;
        const dLng = now.lng - center.lng;
        shape?.setLatLngs(latlngs.map((item) => L.latLng(item.lat + dLat, item.lng + dLng)));
      });
      mover.on('dragend', () => {
        const from = this.projection.toPoint(center);
        const to = this.projection.toPoint(mover.getLatLng());
        this.events.translate({ dx: to.x - from.x, dy: to.y - from.y });
      });
      this.sketchGroup.addLayer(mover);
    }
  }

  private handle(latlng: L.LatLng, className: string, title: string, symbol = ''): L.Marker {
    return L.marker(latlng, {
      pane: PANES.handles.name,
      draggable: true,
      keyboard: false,
      title,
      icon: L.divIcon({
        className,
        html: symbol ? `<span aria-hidden="true">${symbol}</span>` : '',
        iconSize: className.includes('move') ? [30, 30] : [16, 16],
      }),
    });
  }

  private label(border: MapBorder): L.Marker {
    return L.marker(this.projection.toLatLng(polygonCentroid(border.points)), {
      pane: PANES.labels.name,
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: 'world-map-border-label-anchor',
        html: `<span class="world-map-border-label" style="--border-color: ${border.color}">${escapeHtml(border.name)}</span>`,
        iconSize: [0, 0],
      }),
    });
  }
}
