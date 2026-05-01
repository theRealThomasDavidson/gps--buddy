import type { IRoutingService } from './IRoutingService'
import { ValhallaRoutingService } from './ValhallaRoutingService'

/** Demo composition root: public Valhalla instance (FOSSGIS, no API key). */
export function createDefaultRoutingService(): IRoutingService {
  return new ValhallaRoutingService()
}
