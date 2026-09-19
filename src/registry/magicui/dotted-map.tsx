import { useMemo, type ReactNode } from "react";
import DottedMapLib from "dotted-map";
import { cn } from "@/lib/utils";

export interface DottedMapMarker {
  lat: number;
  lng: number;
  /** Relative marker weight (e.g. audience share). Purely informational — up to `renderMarkerOverlay` to use it. */
  size?: number;
}

export interface DottedMapMarkerPosition {
  /** Percentage (0-100) from the left edge of the map. */
  x: number;
  /** Percentage (0-100) from the top edge of the map. */
  y: number;
}

interface DottedMapProps<Marker extends DottedMapMarker> {
  markers: Marker[];
  /** Renders content positioned at each marker's projected x/y (e.g. a flag + label pill). */
  renderMarkerOverlay?: (marker: Marker, position: DottedMapMarkerPosition) => ReactNode;
  className?: string;
  /** Classes applied to the dot-grid SVG wrapper — controls the dot color via `currentColor`. */
  dotClassName?: string;
  /** Number of dot rows top-to-bottom; more rows means a denser grid. */
  height?: number;
}

/**
 * A dotted world map (built on the `dotted-map` package) with markers placed
 * by lat/lng. Visuals for each marker are supplied via `renderMarkerOverlay`
 * so callers can draw flags, pills, tooltips, etc. at the projected point.
 */
export function DottedMap<Marker extends DottedMapMarker>({
  markers,
  renderMarkerOverlay,
  className,
  dotClassName,
  height = 60,
}: DottedMapProps<Marker>) {
  const { svg, positioned } = useMemo(() => {
    const map = new DottedMapLib({ height, grid: "diagonal" });
    const positioned = markers.flatMap((marker) => {
      const pin = map.getPin({ lat: marker.lat, lng: marker.lng });
      if (!pin) return [];
      return [
        {
          marker,
          position: {
            x: (pin.x / map.image.width) * 100,
            y: (pin.y / map.image.height) * 100,
          },
        },
      ];
    });
    const svg = map.getSVG({
      shape: "circle",
      color: "currentColor",
      backgroundColor: "transparent",
      radius: 0.22,
    });
    return { svg, positioned };
  }, [markers, height]);

  return (
    <div className={cn("relative w-full", className)}>
      <div
        aria-hidden="true"
        className={cn("text-muted-foreground/30 [&>svg]:h-full [&>svg]:w-full", dotClassName)}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {positioned.map(({ marker, position }, index) => (
        <div
          key={index}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${position.x}%`, top: `${position.y}%` }}
        >
          {renderMarkerOverlay?.(marker, position)}
        </div>
      ))}
    </div>
  );
}
