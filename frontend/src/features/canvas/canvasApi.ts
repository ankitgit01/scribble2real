export interface CanvasApi {
  exportLineMapPNG(): Promise<Blob>
  exportColorLayerPNG(): Promise<Blob | null>
  exportReferencePNG(): Promise<Blob | null>
  exportCompositePNG(): Promise<Blob>
  hasLineContent(): boolean
  importSketch(blob: Blob): Promise<void>
  replaceCanvasWithImage(blob: Blob): Promise<void>
  hasRasterBaseline(): boolean
  setReference(blob: Blob | null): Promise<void>
  clearLineLayer(): void
  clearAll(): void
  onContentChange(callback: () => void): () => void
}
let activeCanvasApi: CanvasApi | null = null
export function registerCanvasApi(api: CanvasApi | null): void { activeCanvasApi = api }
export function getCanvasApi(): CanvasApi | null { return activeCanvasApi }
