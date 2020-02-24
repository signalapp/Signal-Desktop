import React from 'react';

interface ReceivedProps {
  text: string;
}
type Props = ReceivedProps;

export const PillDivider: React.SFC<Props> = props => {
  return (
    <div className="panel-text-divider">
      <div className="panel-text-divider-line" />
      <span>{props.text}</span>
      <div className="panel-text-divider-line" />
    </div>
  );
};
