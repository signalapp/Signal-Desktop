/**
 * @prettier
 */
import React from 'react';

import classNames from 'classnames';

interface Props {
  imageURL?: string;
  save: () => void;
  close: () => void;
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'row',
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 40,
  } as React.CSSProperties,
  objectContainer: {
    display: 'inline-flex',
    justifyContent: 'center',
  } as React.CSSProperties,
  image: {
    flexGrow: 1,
    flexShrink: 0,
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  } as React.CSSProperties,
  controls: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    marginLeft: 10,
  } as React.CSSProperties,
};

interface IconButtonProps {
  type: 'save' | 'close';
  onClick?: () => void;
}
const IconButton = ({ onClick, type }: IconButtonProps) => (
  <a href="#" onClick={onClick} className={classNames('iconButton', type)} />
);

export class Lightbox extends React.Component<Props, {}> {
  public componentDidMount() {
    const useCapture = true;
    document.addEventListener('keyup', this.onKeyUp, useCapture);
  }

  public componentWillMount() {
    const useCapture = true;
    document.removeEventListener('keyup', this.onKeyUp, useCapture);
  }

  public render() {
    const { imageURL } = this.props;
    return (
      <div style={styles.container}>
        <div style={styles.objectContainer}>
          <img style={styles.image} src={imageURL} />
        </div>
        <div style={styles.controls}>
          <IconButton type="close" onClick={this.props.close} />
          <IconButton type="save" onClick={this.props.save} />
        </div>
      </div>
    );
  }

  private onKeyUp = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') {
      return;
    }

    this.props.close();
  };
}
