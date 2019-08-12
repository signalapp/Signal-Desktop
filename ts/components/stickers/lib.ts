import { StickerPackType } from '../../state/ducks/stickers';

// This function exists to force stickers to be counted consistently wherever
// they are counted (TypeScript ensures that all data is named and provided)
export function countStickers(o: {
  knownPacks: ReadonlyArray<StickerPackType>;
  blessedPacks: ReadonlyArray<StickerPackType>;
  installedPacks: ReadonlyArray<StickerPackType>;
  receivedPacks: ReadonlyArray<StickerPackType>;
}) {
  return (
    o.knownPacks.length +
    o.blessedPacks.length +
    o.installedPacks.length +
    o.receivedPacks.length
  );
}
