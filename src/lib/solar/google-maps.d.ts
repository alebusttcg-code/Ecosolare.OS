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
  class LatLng {
    lat(): number
    lng(): number
  }
  class Marker {
    constructor(opts?: Record<string, unknown>)
    setMap(map: Map | null): void
    setOptions(opts: Record<string, unknown>): void
    setVisible(visible: boolean): void
    addListener(eventName: string, handler: (...args: unknown[]) => void): MapsEventListener
  }
  class Rectangle {
    constructor(opts?: Record<string, unknown>)
    setMap(map: Map | null): void
  }
  class Polygon {
    constructor(opts?: Record<string, unknown>)
    setMap(map: Map | null): void
    setOptions(opts: Record<string, unknown>): void
    setPath(path: Array<{ lat: number; lng: number }>): void
    getPath(): MVCArray<LatLng>
    addListener(eventName: string, handler: (...args: unknown[]) => void): MapsEventListener
  }
  class MVCArray<T> {
    getLength(): number
    getAt(i: number): T
    addListener(eventName: string, handler: (...args: unknown[]) => void): MapsEventListener
  }
  interface MapsEventListener {
    remove(): void
  }
  const SymbolPath: { CIRCLE: number }
  const event: {
    clearInstanceListeners(instance: object): void
  }
}

declare namespace google {
  const maps: typeof google.maps
}
