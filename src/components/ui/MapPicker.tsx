import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Layers, RotateCcw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export type TileLayerType = 'openstreet' | 'google' | 'google-earth';

interface TileLayerConfig {
  name: string;
  url: string;
  attribution: string;
}

const TILE_LAYERS: Record<TileLayerType, TileLayerConfig> = {
  openstreet: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  google: {
    name: 'Google Maps',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>'
  },
  'google-earth': {
    name: 'Google Earth',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; <a href="https://earth.google.com">Google Earth</a>'
  }
};

interface MapPickerProps {
  initialPosition?: [number, number];
  initialZoom?: number;
  selectedPosition?: [number, number]; // Add this for external selected position
  height?: string;
  onChange?: (lat: number, lng: number) => void;
  onTileLayerChange?: (layerType: TileLayerType) => void;
  showControls?: boolean;
  className?: string;
}

interface MapClickHandlerProps {
  onPositionSelect: (lat: number, lng: number) => void;
}

const MapClickHandler: React.FC<MapClickHandlerProps> = ({ onPositionSelect }) => {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onPositionSelect(lat, lng);
    },
  });
  return null;
};

export const MapPicker: React.FC<MapPickerProps> = ({
  initialPosition = [-6.2088, 106.8456], // Default: Jakarta
  initialZoom = 13,
  selectedPosition: externalSelectedPosition,
  height = '400px',
  onChange,
  onTileLayerChange,
  showControls = true,
  className = ''
}) => {
  const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(externalSelectedPosition || null);
  const [currentTileLayer, setCurrentTileLayer] = useState<TileLayerType>('google');
  const [mapCenter, setMapCenter] = useState<[number, number]>(externalSelectedPosition || initialPosition);

  const handlePositionSelect = useCallback((lat: number, lng: number) => {
    const newPosition: [number, number] = [lat, lng];
    setSelectedPosition(newPosition);
    setMapCenter(newPosition);
    onChange?.(lat, lng);
  }, [onChange]);

  const handleTileLayerChange = useCallback((layerType: TileLayerType) => {
    setCurrentTileLayer(layerType);
    onTileLayerChange?.(layerType);
  }, [onTileLayerChange]);

  // Sync selectedPosition with externalSelectedPosition
  useEffect(() => {
    if (externalSelectedPosition) {
      setSelectedPosition(externalSelectedPosition);
      setMapCenter(externalSelectedPosition);
    }
  }, [externalSelectedPosition]);

  const resetMap = useCallback(() => {
    setSelectedPosition(null);
    setMapCenter(initialPosition);
    onChange?.(initialPosition[0], initialPosition[1]);
  }, [initialPosition, onChange]);

  const currentTileConfig = TILE_LAYERS[currentTileLayer];

  return (
    <div className={`relative ${className}`}>
      {/* Map Controls */}
      {showControls && (
        <div className="absolute top-4 left-4 z-[1000] space-y-2">
          {/* Tile Layer Selector */}
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border p-2">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Map Type</span>
            </div>
            <Select value={currentTileLayer} onValueChange={handleTileLayerChange}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TILE_LAYERS).map(([key, config]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reset Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={resetMap}
            className="bg-white/95 backdrop-blur-sm h-8 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
      )}

      {/* Current Position Info */}
      {selectedPosition && showControls && (
        <div className="absolute top-4 right-4 z-[1000]">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border p-3">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium">Selected Location</span>
            </div>
            <div className="space-y-1">
              <div className="text-xs">
                <span className="text-muted-foreground">Lat: </span>
                <span className="font-mono">{selectedPosition[0].toFixed(6)}</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Lng: </span>
                <span className="font-mono">{selectedPosition[1].toFixed(6)}</span>
              </div>
            </div>
            <Badge variant="secondary" className="mt-2 text-xs">
              {currentTileConfig.name}
            </Badge>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="rounded-lg border overflow-hidden" style={{ height }}>
        <MapContainer
          center={mapCenter}
          zoom={initialZoom}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url={currentTileConfig.url}
            attribution={currentTileConfig.attribution}
          />
          <MapClickHandler onPositionSelect={handlePositionSelect} />
          {selectedPosition && (
            <Marker position={selectedPosition}>
              <Popup>
                <div className="text-sm">
                  <div className="font-medium mb-1">Selected Location</div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-muted-foreground">Latitude: </span>
                      <span className="font-mono">{selectedPosition[0].toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Longitude: </span>
                      <span className="font-mono">{selectedPosition[1].toFixed(6)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-green-600 mt-2">
                    Click anywhere to select new location
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Instructions */}
      {showControls && (
        <div className="mt-2 text-xs text-muted-foreground text-center">
          Click on the map to select a location. Use the controls above to change map type.
        </div>
      )}
    </div>
  );
};

export default MapPicker;
