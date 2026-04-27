import { describe, expect, it } from 'vitest'
import { createMapDisplay } from './createMapDisplay'
import { RasterTileMapDisplay } from './display/RasterTileMapDisplay'

describe('createMapDisplay', () => {
  it('returns raster display for raster kind', () => {
    expect(createMapDisplay({ kind: 'raster' })).toBeInstanceOf(RasterTileMapDisplay)
  })

  it('returns raster display for vector placeholder kind', () => {
    expect(createMapDisplay({ kind: 'vector' })).toBeInstanceOf(RasterTileMapDisplay)
  })
})

