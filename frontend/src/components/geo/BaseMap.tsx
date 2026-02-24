import { useEffect, useRef, useCallback, useState } from "react";
import DeckGL from "@deck.gl/react";
import type { MapViewState, LayersList } from "@deck.gl/core";
import type { ViewStateChangeParameters } from "@deck.gl/core/dist/controllers/controller";
import { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const DEFAULT_VIEW_STATE: MapViewState = {
  longitude: 0,
  latitude: 20,
  zoom: 2,
  pitch: 0,
  bearing: 0,
};

const DEFAULT_MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

interface BaseMapProps {
  layers?: LayersList;
  initialViewState?: MapViewState;
  mapStyle?: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: boolean;
}

function BaseMap({
  layers,
  initialViewState,
  mapStyle,
  className,
  style,
  loading = false,
}: BaseMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [viewState, setViewState] = useState<MapViewState>(
    initialViewState ?? DEFAULT_VIEW_STATE,
  );

  // Initialize MapLibre GL base map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: mapStyle ?? DEFAULT_MAP_STYLE,
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      pitch: viewState.pitch ?? 0,
      bearing: viewState.bearing ?? 0,
      interactive: false,
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Re-create map only when style changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle]);

  // Sync MapLibre viewport when DeckGL view state changes
  const onViewStateChange = useCallback(
    ({ viewState: vs }: ViewStateChangeParameters<MapViewState>) => {
      setViewState(vs);
      mapRef.current?.jumpTo({
        center: [vs.longitude, vs.latitude],
        zoom: vs.zoom,
        pitch: vs.pitch ?? 0,
        bearing: vs.bearing ?? 0,
      });
    },
    [],
  );

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 200,
        ...style,
      }}
      data-testid="basemap-container"
    >
      <div
        ref={mapContainerRef}
        style={{ position: "absolute", inset: 0 }}
        data-testid="basemap-maplibre"
      />
      <DeckGL
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={true}
        layers={layers ?? []}
        style={{ position: "absolute", inset: 0 }}
      />
      {loading && (
        <div
          data-testid="basemap-loading"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            zIndex: 10,
          }}
        >
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
        </div>
      )}
    </div>
  );
}

export type { BaseMapProps };
export default BaseMap;
