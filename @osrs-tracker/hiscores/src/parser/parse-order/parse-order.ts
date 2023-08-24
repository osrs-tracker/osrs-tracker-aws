import { HiscoreLineType } from '../../models/hiscore.model';
import { PO_2023_04_13 } from './po-2023-04-13';
import { PO_2023_05_25 } from './po-2023-05-24';
import { PO_2023_07_27 } from './po-2023-07-27';
import { PO_2023_08_24 } from './po-2023-08-24';
import { PO_DEFAULT } from './po-default';

export type ParseOrder = HiscoreLineType[];

export const ParseOrderMap: { [date: string]: ParseOrder } = {
  '2023-08-24': PO_2023_08_24,
  '2023-07-27': PO_2023_07_27,
  '2023-05-25': PO_2023_05_25,
  '2023-04-13': PO_2023_04_13,
  '2023-03-15': PO_DEFAULT,
};
