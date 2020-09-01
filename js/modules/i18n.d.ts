import { LocalizerType } from '../../ts/types/Util';

export const setup: (
  language: string,
  messages: Record<string, unknown>
) => LocalizerType;
