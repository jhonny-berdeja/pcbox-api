import { AdministrationResponse } from '../../../common/database/administration/administration.mapper';

/** HTTP response shape for `POST /pcbox` — identical to the shared `AdministrationResponse` (also used verbatim by `database`'s `DatabaseResponse`); kept as its own named type per this module's `dto/` convention. */
export type PcboxResponse = AdministrationResponse;
