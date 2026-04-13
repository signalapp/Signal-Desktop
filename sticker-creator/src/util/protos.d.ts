type $Oneof<Variants extends Record<string, unknown>> = {
  [Key in keyof Variants]: {
    [RequiredKey in Key]: Variants[RequiredKey]
  } & {
    /** @deprecated */
    [PartialKey in Exclude<keyof Variants, Key>]?: never;
  };
}[keyof Variants];
export namespace StickerPack {
export namespace Sticker {
  export function decode(
    data: Uint8Array<ArrayBuffer>,
  ): Sticker;
  export function encode(data: Params): Uint8Array<ArrayBuffer>;
  export type Params = {
    $unknown?: Array<Uint8Array<ArrayBuffer>> | null;
    id: number | null;
    emoji: string | null;
  };
}
export type Sticker = {
  $unknown: Array<Uint8Array<ArrayBuffer>>;
  id: number | null;
  emoji: string | null;
};
  export function decode(
    data: Uint8Array<ArrayBuffer>,
  ): StickerPack;
  export function encode(data: Params): Uint8Array<ArrayBuffer>;
  export type Params = {
    $unknown?: Array<Uint8Array<ArrayBuffer>> | null;
    title: string | null;
    author: string | null;
    cover: StickerPack.Sticker.Params | null;
    stickers: Array<StickerPack.Sticker.Params> | null;
  };
}
export type StickerPack = {
  $unknown: Array<Uint8Array<ArrayBuffer>>;
  title: string | null;
  author: string | null;
  cover: StickerPack.Sticker | null | null;
  stickers: Array<StickerPack.Sticker>;
};