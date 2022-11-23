import { ipcRenderer } from 'electron';
import type { GifChannelTypeSpec } from '../types/Gifs';
import { GIF_CHANNEL_PREFIX } from '../types/Gifs';

const createMessagePasser =
  <K extends keyof GifChannelTypeSpec>(eventName: K) =>
  (
    ...args: GifChannelTypeSpec[K]['args']
  ): Promise<GifChannelTypeSpec[K]['result']> =>
    ipcRenderer.invoke(`${GIF_CHANNEL_PREFIX}:${eventName}`, ...args);

/**
 * Wrapper for GiphyFetch by passing events to another process.
 * TypeScript guarantees that all events are exposed and that
 * the returned types match.
 */
export const GiphyRendererWrapper: {
  [K in keyof GifChannelTypeSpec]: (
    ...args: GifChannelTypeSpec[K]['args']
  ) => Promise<GifChannelTypeSpec[K]['result']>;
} = {
  gifs: createMessagePasser('gifs'),
  search: createMessagePasser('search'),
  trending: createMessagePasser('trending'),
};
