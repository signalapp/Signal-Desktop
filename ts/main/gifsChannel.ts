// Needed for @giphy/js-fetch-api,
// see https://github.com/Giphy/giphy-js/issues/58#issuecomment-612978479
import 'cross-fetch/polyfill';
import type { SearchOptions, TrendingOptions } from '@giphy/js-fetch-api';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { ipcMain } from 'electron';
import type { GifChannelTypeSpec } from '../types/Gifs';
import { GIF_CHANNEL_PREFIX } from '../types/Gifs';

// Signal iOS API Key, taken from
// https://github.com/signalapp/Signal-iOS/blob/main/SignalServiceKit/src/Network/API/Giphy/GiphyAPI.swift
// TODO: Replace this with a different API key
const API_KEY = 'ZsUpUm2L6cVbvei347EQNp7HrROjbOdc';

const giphy = new GiphyFetch(API_KEY);

// Object containing handlers for all the events that
// can be sent over the Gifs channel. Completeness and
// correctness is guaranteed by TypeScript.
const handlers: {
  [K in keyof GifChannelTypeSpec]: (
    event: Electron.IpcMainInvokeEvent,
    ...args: GifChannelTypeSpec[K]['args']
  ) => Promise<GifChannelTypeSpec[K]['result']>;
} = {
  search: async (
    _: Electron.IpcMainInvokeEvent,
    term: string,
    options?: SearchOptions
  ) => {
    return giphy.search(term, options);
  },
  trending: async (
    _: Electron.IpcMainInvokeEvent,
    options?: TrendingOptions
  ) => {
    return giphy.trending(options);
  },
  gifs: async (_: Electron.IpcMainInvokeEvent, ids: Array<string>) => {
    return giphy.gifs(ids);
  },
};

const installHandler = <K extends keyof GifChannelTypeSpec>(
  eventName: K,
  handler: (
    event: Electron.IpcMainInvokeEvent,
    ...args: GifChannelTypeSpec[K]['args']
  ) => Promise<GifChannelTypeSpec[K]['result']>
): void => {
  // Our strict typing ensures that we send the correct events, but
  // it's now too strict for the general ipcMain typings. Hence,
  // the casting to any is necessary :/
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle(`${GIF_CHANNEL_PREFIX}:${eventName}`, handler as any);
};

export const installGifsChannel = (): void => {
  (Object.keys(handlers) as Array<keyof GifChannelTypeSpec>).forEach(
    <K extends keyof GifChannelTypeSpec>(eventName: K) =>
      installHandler(eventName, handlers[eventName])
  );
};
