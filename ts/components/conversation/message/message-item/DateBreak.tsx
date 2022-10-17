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

  color: var(--text-primary-color);
`;

export const MessageDateBreak = (props: { timestamp: number; messageId: string }) => {
  const { timestamp, messageId } = props;
  const text = moment(timestamp).calendar(undefined, {
    sameElse: 'llll',
  });

  return (
    <DateBreakContainer id={`date-break-${messageId}`}>
      <DateBreakText>{text}</DateBreakText>
    </DateBreakContainer>
  );
};
