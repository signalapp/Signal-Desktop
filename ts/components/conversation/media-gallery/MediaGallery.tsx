import React from 'react';

interface Props {
  number: number;
}

export class MediaGallery extends React.Component<Props, {}> {
  public render() {
    return (
      <div>Hello Media Gallery! Number: {this.props.number}</div>
    );
  }
}
