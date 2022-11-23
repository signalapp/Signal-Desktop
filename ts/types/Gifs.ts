import type {
  GifsResult,
  SearchOptions,
  TrendingOptions,
} from '@giphy/js-fetch-api';

export const GIF_CHANNEL_PREFIX = 'giphy-wrapper';

export type GifChannelTypeSpec = {
  search: {
    args: [string, SearchOptions | undefined];
    result: GifsResult;
  };
  gifs: {
    args: [Array<string>];
    result: GifsResult;
  };
  trending: {
    args: [TrendingOptions | undefined];
    result: GifsResult;
  };
};
