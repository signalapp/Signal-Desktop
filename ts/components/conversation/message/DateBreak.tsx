import moment from 'moment';
import React from 'react';
import styled from 'styled-components';

const DateBreakContainer = styled.div``;

const DateBreakText = styled.div`
  margin-top: 0.3rem;
  margin-bottom: 0.3rem;
  letter-spacing: 0.6px;
  font-size: 0.8rem;
  font-weight: bold;
  text-align: center;

  color: ${props => props.theme.colors.lastSeenIndicatorTextColor};
`;

export const MessageDateBreak = (props: { timestamp: number }) => {
  const { timestamp } = props;
  moment().calendar();

  const text = moment().calendar(timestamp, {
    sameElse: 'llll',
  });
  return (
    <DateBreakContainer id={`date-break-${timestamp}`}>
      <DateBreakText>{text}</DateBreakText>
    </DateBreakContainer>
  );
};
