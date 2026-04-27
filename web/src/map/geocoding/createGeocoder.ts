import { ChainedGeocoder } from './ChainedGeocoder'
import { NominatimGeocoder } from './NominatimGeocoder'
import { OpenMeteoGeocoder } from './OpenMeteoGeocoder'
import { PhotonGeocoder } from './PhotonGeocoder'
import type { IGeocoder } from './IGeocoder'

export function createDefaultChainedGeocoder(): IGeocoder {
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL as string | undefined

  const providers: IGeocoder[] = [
    new PhotonGeocoder(),
    new OpenMeteoGeocoder(),
    new NominatimGeocoder({ contactEmail }),
  ]

  return new ChainedGeocoder(providers, { dedupeMeters: 35 })
}
