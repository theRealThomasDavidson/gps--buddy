import type { IMapDisplay } from './display/IMapDisplay'
import { RasterTileMapDisplay } from './display/RasterTileMapDisplay'

export type CreateMapDisplayOptions =
  | {
      kind: 'raster'
    }
  | {
      kind: 'vector'
      // placeholder: vector options later
    }

export function createMapDisplay(options: CreateMapDisplayOptions): IMapDisplay {
  switch (options.kind) {
    case 'raster':
      return new RasterTileMapDisplay()
    case 'vector':
      // Not implemented yet; returning raster keeps the app usable until vector is wired.
      return new RasterTileMapDisplay()
  }
}

