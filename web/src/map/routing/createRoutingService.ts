import type { IRoutingService } from './IRoutingService'
import { OsrmRoutingService } from './OsrmRoutingService'

/** Demo composition root: public OSRM demo backend. */
export function createDefaultRoutingService(): IRoutingService {
  return new OsrmRoutingService()
}
