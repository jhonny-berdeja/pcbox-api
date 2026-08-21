import { AdministrationResponse } from '../../../common/database/administration/administration.mapper';

/** HTTP response shape for `POST /database` — identical to the shared `AdministrationResponse` (also used verbatim by `pcbox`'s `PcboxResponse`); kept as its own named type per this module's `dto/` convention. */
export type DatabaseResponse = AdministrationResponse;
