declare module 'geotiff-geokeys-to-proj4' {
  export function toProj4(geoKeys: unknown): {
    proj4: string
    coordinatesConversionParameters: { x: number; y: number; z?: number }
    errors?: unknown
  }
  const geokeysToProj4: {
    toProj4: typeof toProj4
  }
  export default geokeysToProj4
}

declare module 'proj4' {
  interface Converter {
    forward(p: { x: number; y: number }): { x: number; y: number }
  }
  function proj4(fromProjection: string, toProjection: string): Converter
  export default proj4
}
