import React from 'react';
import styled from 'styled-components';
import { LabelWithInfo } from '.';
import { PropsForAttachment } from '../../../../../../state/ducks/conversations';
import { Flex } from '../../../../../basic/Flex';

type Props = {
  attachment: PropsForAttachment;
};

const StyledLabelContainer = styled(Flex)`
  div {
    // we want 2 items per row and that's the easiest to make it happen
    min-width: 50%;
  }
`;

export const AttachmentInfo = (props: Props) => {
  const { attachment } = props;

  return (
    <Flex container={true} flexDirection="column">
      <LabelWithInfo
        label={`${window.i18n('fileId')}:`}
        info={attachment?.id ? String(attachment.id) : window.i18n('notApplicable')}
      />
      <StyledLabelContainer container={true} flexDirection="row" flexWrap="wrap">
        <LabelWithInfo
          label={`${window.i18n('fileType')}:`}
          info={
            attachment?.contentType ? String(attachment.contentType) : window.i18n('notApplicable')
          }
        />
        <LabelWithInfo
          label={`${window.i18n('fileSize')}:`}
          info={attachment?.fileSize ? String(attachment.fileSize) : window.i18n('notApplicable')}
        />
        <LabelWithInfo
          label={`${window.i18n('resolution')}:`}
          info={
            attachment?.width && attachment.height
              ? `${attachment.width}x${attachment.height}`
              : window.i18n('notApplicable')
          }
        />
        <LabelWithInfo
          label={`${window.i18n('duration')}:`}
          info={attachment?.duration ? attachment?.duration : window.i18n('notApplicable')}
        />
      </StyledLabelContainer>
    </Flex>
  );
};
