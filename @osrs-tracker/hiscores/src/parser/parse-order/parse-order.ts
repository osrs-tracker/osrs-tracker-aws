import { HiscoreLineType } from '../../models/hiscore.model';
import { PO_2023_04_13 } from './po-2023-04-13';
import { PO_2023_05_25 } from './po-2023-05-24';
import { PO_2023_07_27 } from './po-2023-07-27';
import { PO_2023_08_23 } from './po-2023-08-23';
import { PO_2024_01_24 } from './po-2024-01-24';
import { PO_2024_03_20 } from './po-2024-03-20';
import { PO_2024_08_28 } from './po-2024-08-28';
import { PO_DEFAULT } from './po-default';

export type ParseOrder = HiscoreLineType[];

export const ParseOrderMap: { [date: string]: ParseOrder } = {
  '2024-08-28': PO_2024_08_28,
  '2024-03-20': PO_2024_03_20,
  '2024-01-24': PO_2024_01_24,
  '2023-08-23': PO_2023_08_23,
  '2023-07-27': PO_2023_07_27,
  '2023-05-25': PO_2023_05_25,
  '2023-04-13': PO_2023_04_13,
  '2023-03-15': PO_DEFAULT,
};
