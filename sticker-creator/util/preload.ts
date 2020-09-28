import { Metadata } from 'sharp';

declare global {
  interface Window {
    processStickerImage: ProcessStickerImageFn;
    encryptAndUpload: EncryptAndUploadFn;
  }
}

export type StickerImageData = {
  buffer: Buffer;
  src: string;
  path: string;
  meta: Metadata & { pages?: number }; // Pages is not currently in the sharp metadata type
};

type ProcessStickerImageFn = (path: string) => Promise<StickerImageData>;

export type StickerData = { imageData?: StickerImageData; emoji?: string };
export type PackMetaData = { packId: string; key: string };

export type EncryptAndUploadFn = (
  manifest: { title: string; author: string },
  stickers: Array<StickerData>,
  cover: StickerImageData,
  onProgress?: () => unknown
) => Promise<PackMetaData>;

export const { encryptAndUpload, processStickerImage } = window;
