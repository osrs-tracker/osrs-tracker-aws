import { HiscoreLineType } from '../../models/hiscore.model';

import * as Parsers_2023 from './2023';
import * as Parsers_2024 from './2024';
import * as Parsers_2025 from './2025';
import * as Parsers_2026 from './2026';
import { PO_DEFAULT } from './po-default';

export type ParseOrder = HiscoreLineType[];

export const ParseOrderMap: { [date: string]: ParseOrder } = {
  '2026-02-25T11': Parsers_2026.PO_2026_02_25,
  '2025-11-19T08': Parsers_2025.PO_2025_11_19,
  '2025-11-05T11': Parsers_2025.PO_2025_11_05,
  '2025-10-15T11': Parsers_2025.PO_2025_10_15,
  '2025-07-23T11': Parsers_2025.PO_2025_07_23,
  '2025-05-14T11': Parsers_2025.PO_2025_05_14,
  '2025-02-05T11': Parsers_2025.PO_2025_02_05,
  '2025-01-29T11': Parsers_2025.PO_2025_01_29,
  '2024-09-25T11': Parsers_2024.PO_2024_09_25,
  '2024-08-28T11': Parsers_2024.PO_2024_08_28,
  '2024-03-20T11': Parsers_2024.PO_2024_03_20,
  '2024-01-24T11': Parsers_2024.PO_2024_01_24,
  '2023-08-23T11': Parsers_2023.PO_2023_08_23,
  '2023-07-27T11': Parsers_2023.PO_2023_07_27,
  '2023-05-25T11': Parsers_2023.PO_2023_05_25,
  '2023-04-13T11': Parsers_2023.PO_2023_04_13,
  '2023-03-15T11': PO_DEFAULT,
};
