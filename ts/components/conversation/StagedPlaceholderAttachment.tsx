import React from 'react';
import { LocalizerType } from '../../types/Util';

interface Props {
  onClick: () => void;
  i18n: LocalizerType;
}

export class StagedPlaceholderAttachment extends React.Component<Props> {
  public render() {
    const { i18n, onClick } = this.props;

    return (
      <button
        className="module-staged-placeholder-attachment"
        onClick={onClick}
        title={i18n('add-image-attachment')}
      >
        <div className="module-staged-placeholder-attachment__plus-icon" />
      </button>
    );
  }
}
