/**
 * @prettier
 */
import React from 'react';

import classNames from 'classnames';
import is from '@sindresorhus/is';

import * as GoogleChrome from '../util/GoogleChrome';
import * as MIME from '../types/MIME';

interface Props {
  close: () => void;
  objectURL: string;
  contentType: MIME.MIMEType | undefined;
  onNext?: () => void;
  onPrevious?: () => void;
  onSave?: () => void;
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
    flexGrow: 1,
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
  type: 'save' | 'close' | 'previous' | 'next';
  onClick?: () => void;
}
const IconButton = ({ onClick, type }: IconButtonProps) => (
  <a href="#" onClick={onClick} className={classNames('iconButton', type)} />
);

export class Lightbox extends React.Component<Props, {}> {
  private containerRef: HTMLDivElement | null = null;

  public componentDidMount() {
    const useCapture = true;
    document.addEventListener('keyup', this.onKeyUp, useCapture);
  }

  public componentWillUnmount() {
    const useCapture = true;
    document.removeEventListener('keyup', this.onKeyUp, useCapture);
  }

  public render() {
    const { contentType, objectURL } = this.props;
    return (
      <div
        style={styles.container}
        onClick={this.onContainerClick}
        ref={this.setContainerRef}
      >
        <div style={styles.objectContainer}>
          {!is.undefined(contentType)
            ? this.renderObject({ objectURL, contentType })
            : null}
        </div>
        <div style={styles.controls}>
          <IconButton type="close" onClick={this.onClose} />
          {this.props.onSave ? (
            <IconButton type="save" onClick={this.props.onSave} />
          ) : null}
          {this.props.onPrevious ? (
            <IconButton type="previous" onClick={this.props.onPrevious} />
          ) : null}
          {this.props.onNext ? (
            <IconButton type="next" onClick={this.props.onNext} />
          ) : null}
        </div>
      </div>
    );
  }

  private renderObject = ({
    objectURL,
    contentType,
  }: {
    objectURL: string;
    contentType: MIME.MIMEType;
  }) => {
    const isImage = GoogleChrome.isImageTypeSupported(contentType);
    if (isImage) {
      return (
        <img
          style={styles.image}
          src={objectURL}
          onClick={this.onObjectClick}
        />
      );
    }

    const isVideo = GoogleChrome.isVideoTypeSupported(contentType);
    if (isVideo) {
      return (
        <video controls>
          <source src={objectURL} />
        </video>
      );
    }

    // tslint:disable-next-line no-console
    console.log('Lightbox: Unexpected content type', { contentType });
    return null;
  };

  private setContainerRef = (value: HTMLDivElement) => {
    this.containerRef = value;
  };

  private onClose = () => {
    const { close } = this.props;
    if (!close) {
      return;
    }

    close();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') {
      return;
    }

    this.onClose();
  };

  private onContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== this.containerRef) {
      return;
    }
    this.onClose();
  };

  private onObjectClick = (event: React.MouseEvent<HTMLImageElement>) => {
    event.stopPropagation();
    this.onClose();
  };
}
