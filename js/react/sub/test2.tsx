import React from 'react';

interface IProps { name: string; }

interface IState { count: number; }


const items = [
  'one',
  'two',
  'three',
  'four',
];

export class InlineReply extends React.Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);

    this.state = {
      count: 0,
    };
  }

  public render() {
    const { name } = this.props;

    return (
      <div>
        This is a basic component. Hi there, {name}!
      </div>
    );
  }
}

export function greeter2(person: any) {
    // console.log(items);
    return `Hello, ${person}`;
}
