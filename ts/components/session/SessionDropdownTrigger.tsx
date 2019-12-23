import React from 'react';

interface Props {
  //mouseButton: Number;
  posX: number;
  posY: number;
}

export class SessionDropdownTrigger extends React.Component<Props> {
  public static defaultProps = {
    //mouseButton: 2, // 0 is left click, 2 is right click
    posX: 0,
    posY: 0,
  };
  constructor(props: any) {
    super(props);
  }

  public handleDropdownClick = (event: any) => {
    event.preventDefault();
    event.stopPropagation();

    /*let x = event.clientX || (event.touches && event.touches[0].pageX);
    let y = event.clientY || (event.touches && event.touches[0].pageY);

    if (this.props.posX) {
      x -= this.props.posX;
    }
    if (this.props.posY) {
      y -= this.props.posY;
    }*/
  };

  public render() {
    return <div role="button" onClick={this.handleDropdownClick} />;
  }
}
