import { ipcRenderer } from 'electron';
import { GiphyFetch } from '@giphy/js-fetch-api';
import type { GifChannelTypeSpec } from '../types/Gifs';
import { GIF_CHANNEL_PREFIX, GIPHY_API_KEY } from '../types/Gifs';

const createMessagePasser =
  <K extends keyof GifChannelTypeSpec>(eventName: K) =>
  (
    ...args: GifChannelTypeSpec[K]['args']
  ): Promise<GifChannelTypeSpec[K]['result']> =>
    ipcRenderer.invoke(`${GIF_CHANNEL_PREFIX}:${eventName}`, ...args);

export type GiphyRendererWrapper = {
  [K in keyof GifChannelTypeSpec]: (
    ...args: GifChannelTypeSpec[K]['args']
  ) => Promise<GifChannelTypeSpec[K]['result']>;
};

/**
 * Wrapper for GiphyFetch by passing events to another process.
 * TypeScript guarantees that all events are exposed and that
 * the returned types match.
 */
export const giphyRendererWrapper: GiphyRendererWrapper = {
  gifs: createMessagePasser('gifs'),
  search: createMessagePasser('search'),
  trending: createMessagePasser('trending'),
};

export const getUnwrappedGiphyForStorybook = (): GiphyRendererWrapper =>
  new GiphyFetch(GIPHY_API_KEY);
