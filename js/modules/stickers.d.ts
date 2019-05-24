export function maybeDeletePack(packId: string): Promise<void>;

export function downloadStickerPack(
  packId: string,
  packKey: string,
  options?: {
    finalStatus?: 'installed' | 'downloaded';
    messageId?: string;
    fromSync?: boolean;
  }
): Promise<void>;
