/** Dichiarazioni minime per Maps JavaScript nel laboratorio Sviluppo. */

declare namespace google.maps {
  class Map {
    constructor(el: HTMLElement, opts?: Record<string, unknown>)
    fitBounds(bounds: LatLngBounds, padding?: number): void
  }
  class LatLngBounds {
    extend(latLng: { lat: number; lng: number }): void
    isEmpty(): boolean
  }
  class Marker {
    constructor(opts?: Record<string, unknown>)
    setMap(map: Map | null): void
  }
  const SymbolPath: { CIRCLE: number }
  class Rectangle {
    constructor(opts?: Record<string, unknown>)
    setMap(map: Map | null): void
  }
}

declare namespace google {
  const maps: typeof google.maps
}
