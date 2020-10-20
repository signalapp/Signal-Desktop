import React, { Component } from 'react';
import { Flex } from '../Flex';
import { SessionIcon, SessionIconSize, SessionIconType } from '../icon';

interface Props {
  handleDrop: (files: FileList) => void;
}

interface State {
  dragging: boolean;
}

export class SessionFileDropzone extends Component<Props, State> {
  private readonly dropRef: React.RefObject<any>;
  private dragCounter: number;

  constructor(props: any) {
    super(props);
    this.state = {
      dragging: false,
    };

    this.dragCounter = 0;
    this.dropRef = React.createRef();
  }

  public handleDrag = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
  };

  public handleDragIn = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    this.dragCounter++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      this.setState({ dragging: true });
    }
  };

  public handleDragOut = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    this.dragCounter--;
    if (this.dragCounter === 0) {
      this.setState({ dragging: false });
    }
  };

  public handleDrop = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ dragging: false });
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      this.props.handleDrop(e.dataTransfer.files);
      e.dataTransfer.clearData();
      this.dragCounter = 0;
    }
  };

  public componentDidMount() {
    const div = this.dropRef.current;
    div.addEventListener('dragenter', this.handleDragIn);
    div.addEventListener('dragleave', this.handleDragOut);
    div.addEventListener('dragover', this.handleDrag);
    div.addEventListener('drop', this.handleDrop);
  }

  public componentWillUnmount() {
    const div = this.dropRef.current;
    div.removeEventListener('dragenter', this.handleDragIn);
    div.removeEventListener('dragleave', this.handleDragOut);
    div.removeEventListener('dragover', this.handleDrag);
    div.removeEventListener('drop', this.handleDrop);
  }

  public render() {
    return (
      <div
        style={{
          display: 'inline-block',
          position: 'absolute',
          width: '100%',
          height: '100%',
        }}
        ref={this.dropRef}
      >
        <div
          style={{
            border: 'dashed grey 4px',
            backgroundColor: 'rgba(255,255,255,0.5)',
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            opacity: this.state.dragging ? 1.0 : 0,
            transition: '0.25s',
          }}
        >
          <Flex
            container={true}
            justifyContent="space-around"
            height="100%"
            alignItems="center"
          >
            <SessionIcon
              iconSize={SessionIconSize.Max}
              iconType={SessionIconType.CirclePlus}
            />
          </Flex>
        </div>

        {this.props.children}
      </div>
    );
  }
}
