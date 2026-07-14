import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
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

interface BornesMapProps {
  bornes: Borne[];
  height?: number;
  zoom?: number;
  showLegend?: boolean;
}

function BornesMap({
  bornes,
  height = 380,
  zoom = 6.4,
  showLegend = true,
}: BornesMapProps) {
  const [mode, setMode] = useState<MapMode>("street");

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
          center={TUNISIA_CENTER}
          zoom={zoom}
          scrollWheelZoom
          style={{ height: "100%", width: "100%", background: "#0f2417" }}
        >
          {mode === "street" ? (
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              maxZoom={20}
            />
          ) : (
            <>
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
                maxZoom={19}
              />
              <TileLayer
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
