import { HiscoreLineType } from '../../models/hiscore.model';

import * as Parsers_2023 from './2023';
import * as Parsers_2024 from './2024';
import * as Parsers_2025 from './2025';
import * as Parsers_2026 from './2026';
import { PO_DEFAULT } from './po-default';

export type ParseOrder = HiscoreLineType[];

export const ParseOrderMap: { [date: string]: ParseOrder } = {
  ...Parsers_2026.PARSE_ORDER_MAP_2026,
  ...Parsers_2025.PARSE_ORDER_MAP_2025,
  ...Parsers_2024.PARSE_ORDER_MAP_2024,
  ...Parsers_2023.PARSE_ORDER_MAP_2023,
  '2023-03-15T11': PO_DEFAULT,
};
