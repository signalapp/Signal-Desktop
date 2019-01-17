import React from 'react';

interface Props {
  onClick: () => void;
}

export class StagedPlaceholderAttachment extends React.Component<Props> {
  public render() {
    const { onClick } = this.props;

    return (
      <div
        className="module-staged-placeholder-attachment"
        role="button"
        onClick={onClick}
      >
        <div className="module-staged-placeholder-attachment__plus-icon" />
      </div>
    );
  }
}
