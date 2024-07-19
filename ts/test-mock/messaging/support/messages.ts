import type { Proto } from '@signalapp/mock-server';
import Long from 'long';

export const createMessage = (body: string): Proto.IDataMessage => {
  return {
    body,
    groupV2: undefined,
    timestamp: Long.fromNumber(Date.now()),
  };
};
