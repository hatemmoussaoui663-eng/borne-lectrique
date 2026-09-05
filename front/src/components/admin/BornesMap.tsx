import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMap,
} from "react-leaflet";
import { divIcon } from "leaflet";
import { EnvironmentOutlined, GlobalOutlined } from "@ant-design/icons";
import "leaflet/dist/leaflet.css";
import type { Borne, BorneEtat } from "../../types";
import "./BornesMap.css";

const TUNISIA_CENTER: [number, number] = [34.4, 9.7];

type MapMode = "street" | "satellite";

const statusColor: Record<BorneEtat, string> = {
  Disponible: "#6fe45c",
  Occupée: "#4da3ff",
  Maintenance: "#f5b545",
  "Hors service": "#ff6b6b",
  Déconnectée: "#8c9a90",
  Défaut: "#ff6b6b",
};

function markerIcon(etat: BorneEtat) {
  const color = statusColor[etat];
  const pulse = etat === "Disponible" || etat === "Occupée";
  return divIcon({
    className: "borne-marker",
    html: `
      <span class="borne-marker__dot" style="background:${color}">
        ${pulse ? `<span class="borne-marker__ping" style="border-color:${color}"></span>` : ""}
      </span>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

const legend: { label: string; etat: BorneEtat }[] = [
  { label: "Disponible", etat: "Disponible" },
  { label: "Occupée", etat: "Occupée" },
  { label: "Maintenance", etat: "Maintenance" },
  { label: "Déconnectée", etat: "Déconnectée" },
  { label: "Défaut / hors service", etat: "Défaut" },
];

/**
 * Marqueur du véhicule suivi : une voiture, là où les bornes sont de simples
 * pastilles rondes. La forme suffit alors à les distinguer, sans dépendre de la
 * couleur — utile quand une borne « Occupée » est bleue elle aussi.
 *
 * SVG en dur plutôt qu'une icône Ant Design : `divIcon` attend une chaîne HTML,
 * pas un composant React.
 */
const vehiculeIcon = divIcon({
  className: "vehicule-marker",
  html: `
    <span class="vehicule-marker__badge">
      <span class="vehicule-marker__ping"></span>
      <svg class="vehicule-marker__car" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
      </svg>
    </span>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -18],
});

/**
 * `MapContainer` ne lit `center` qu'au montage : sans ce composant, la carte
 * resterait figée pendant que le véhicule se déplace. Il ne recentre que si le
 * point sort de la vue, pour ne pas contrarier un utilisateur en train de
 * déplacer la carte à la main.
 */
function SuivrePoint({ point }: { point: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!point) return;
    if (!map.getBounds().contains(point)) {
      map.setView(point, map.getZoom(), { animate: true });
    }
  }, [map, point]);

  return null;
}

interface VehiculeSuivi {
  lat: number;
  lng: number;
  label: string;
  /** Rayon d'incertitude GPS en mètres, dessiné autour du marqueur. */
  precisionM?: number | null;
}

interface BornesMapProps {
  bornes: Borne[];
  height?: number;
  zoom?: number;
  showLegend?: boolean;
  /** Véhicule à afficher et à suivre (suivi GPS temps réel). */
  vehicule?: VehiculeSuivi | null;
  /** Borne mise en avant, reliée au véhicule par un trait. */
  borneProcheId?: string | null;
}

function BornesMap({
  bornes,
  height = 380,
  zoom = 6.4,
  showLegend = true,
  vehicule = null,
  borneProcheId = null,
}: BornesMapProps) {
  const [mode, setMode] = useState<MapMode>("street");
  const borneProche = borneProcheId
    ? (bornes.find((b) => b.id === borneProcheId) ?? null)
    : null;

  return (
    <div>
      <div className={`bornes-map bornes-map--${mode}`} style={{ height }}>
        <div className="bornes-map__modes">
          <button
            type="button"
            className={mode === "street" ? "is-active" : ""}
            onClick={() => setMode("street")}
          >
            <EnvironmentOutlined /> Carte
          </button>
          <button
            type="button"
            className={mode === "satellite" ? "is-active" : ""}
            onClick={() => setMode("satellite")}
          >
            <GlobalOutlined /> Satellite
          </button>
        </div>

        <MapContainer
          center={vehicule ? [vehicule.lat, vehicule.lng] : TUNISIA_CENTER}
          zoom={zoom}
          scrollWheelZoom
          style={{ height: "100%", width: "100%", background: "#0f2417" }}
        >
          {mode === "street" ? (
            // Fond sombre servi par Esri, comme la vue satellite ci-dessous.
            // CARTO exige désormais une clé d'API et estampille « API KEY
            // REQUIRED » en travers de ses tuiles ; Esri n'en demande pas.
            // Ses tuiles s'arrêtant au zoom 16, `maxNativeZoom` laisse Leaflet
            // agrandir les dernières plutôt que d'afficher du vide au-delà.
            <>
              <TileLayer
                // Noirci par CSS (voir .bornes-map__basemap) : Leaflet pose
                // cette classe sur le conteneur de tuiles de cette couche-ci,
                // ce qui laisse les libellés de la couche suivante intacts.
                // La `key` n'est pas décorative : react-leaflet ne met à jour
                // que l'`url` d'une TileLayer déjà montée, jamais sa
                // `className`. Sans clés distinctes, React recyclerait cette
                // couche pour l'imagerie satellite, qui hériterait alors de ce
                // filtre et s'afficherait en gris désaturé.
                key="street-base"
                className="bornes-map__basemap"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
                maxZoom={19}
                maxNativeZoom={16}
              />
              {/* Couche séparée chez Esri : sans elle, la carte n'a aucun nom de ville. */}
              <TileLayer
                key="street-labels"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
                maxNativeZoom={16}
              />
            </>
          ) : (
            <>
              <TileLayer
                key="satellite-imagery"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
                maxZoom={19}
              />
              <TileLayer
                key="satellite-labels"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
            </>
          )}
          {bornes.map((b) => (
            <Marker
              key={b.id}
              position={[b.lat, b.lng]}
              icon={markerIcon(b.etat)}
            >
              <Popup>
                <div className="borne-popup">
                  <strong>{b.nom}</strong>
                  <span>{b.ville}</span>
                  <div className="borne-popup__row">
                    <span>{b.puissance} kW</span>
                    <span
                      className="borne-popup__etat"
                      style={{ color: statusColor[b.etat] }}
                    >
                      {b.etat}
                    </span>
                  </div>
                  <span className="borne-popup__meta">
                    Heartbeat {b.dernierHeartbeat}
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}

          {vehicule && (
            <>
              <SuivrePoint point={[vehicule.lat, vehicule.lng]} />

              {/* Trait vers la borne la plus proche : répond d'un coup d'œil à
                  « laquelle est la plus proche de ma voiture ? » */}
              {borneProche && (
                <Polyline
                  positions={[
                    [vehicule.lat, vehicule.lng],
                    [borneProche.lat, borneProche.lng],
                  ]}
                  pathOptions={{ color: "#6fe45c", weight: 2, dashArray: "6 6", opacity: 0.85 }}
                />
              )}

              {/* Cercle d'incertitude : un point GPS sans sa précision laisse
                  croire à une exactitude qu'on n'a pas. */}
              {vehicule.precisionM ? (
                <Circle
                  center={[vehicule.lat, vehicule.lng]}
                  radius={vehicule.precisionM}
                  pathOptions={{ color: "#4da3ff", weight: 1, fillOpacity: 0.12 }}
                />
              ) : null}

              <Marker position={[vehicule.lat, vehicule.lng]} icon={vehiculeIcon}>
                <Popup>
                  <div className="borne-popup">
                    <strong>{vehicule.label}</strong>
                    <span>Position actuelle</span>
                    {vehicule.precisionM ? (
                      <span className="borne-popup__meta">
                        Précision ~{Math.round(vehicule.precisionM)} m
                      </span>
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>

      {showLegend && (
        <div className="bornes-map-legend">
          {legend.map((l) => (
            <span key={l.label} className="bornes-map-legend__item">
              <span
                className="bornes-map-legend__dot"
                style={{ background: statusColor[l.etat] }}
              />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default BornesMap;
