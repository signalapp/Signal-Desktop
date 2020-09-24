import React from 'react';
import { LocalizerType } from '../../types/Util';

interface Props {
  onClick: () => void;
  i18n: LocalizerType;
}

export const StagedPlaceholderAttachment = ({
  i18n,
  onClick,
}: Props): JSX.Element => (
  <button
    type="button"
    className="module-staged-placeholder-attachment"
    onClick={onClick}
    title={i18n('add-image-attachment')}
  >
    <div className="module-staged-placeholder-attachment__plus-icon" />
  </button>
);
