import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { StickerPreviewModal } from '../../components/stickers/StickerPreviewModal';
import { StateType } from '../reducer';

import { getIntl, getStickersPath } from '../selectors/user';
import {
  getBlessedPacks,
  getPacks,
  translatePackFromDB,
} from '../selectors/stickers';

type ExternalProps = {
  packId: string;
  readonly onClose: () => unknown;
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { packId } = props;
  const stickersPath = getStickersPath(state);
  const packs = getPacks(state);
  const blessedPacks = getBlessedPacks(state);
  const pack = packs[packId];

  if (!pack) {
    throw new Error(`Cannot find pack ${packId}`);
  }
  const translated = translatePackFromDB(
    pack,
    packs,
    blessedPacks,
    stickersPath
  );

  return {
    ...props,
    pack: {
      ...translated,
      cover: translated.cover
        ? translated.cover
        : {
            id: 0,
            url: 'nonexistent',
            packId,
            emoji: 'WTF',
          },
    },
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartStickerPreviewModal = smart(StickerPreviewModal);
