import React from 'react';
import styled from 'styled-components';

import { Image } from './Image';

import { SessionSpinner } from '../basic/SessionSpinner';
import { StagedLinkPreviewImage } from './composition/CompositionBox';
import { isImage } from '../../types/MIME';
import { fromArrayBufferToBase64 } from '../../session/utils/String';
import { Flex } from '../basic/Flex';
import { SessionIconButton } from '../icon';

type Props = {
  isLoaded: boolean;
  title: null | string;
  url: null | string;
  domain: null | string;
  image?: StagedLinkPreviewImage;

  onClose: (url: string) => void;
};

// Note Similar to QuotedMessageComposition
const StyledStagedLinkPreview = styled(Flex)`
  position: relative;
  /* Same height as a loaded Image Attachment */
  min-height: 132px;
  border-top: 1px solid var(--border-color);
`;

const StyledImage = styled.div`
  div {
    border-radius: 4px;
    overflow: hidden;
  }
`;

const StyledText = styled(Flex)`
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  display: -webkit-box;
  font-weight: bold;
  margin: 0 0 0 var(--margins-sm);
`;

export const StagedLinkPreview = (props: Props) => {
  const { isLoaded, onClose, title, image, domain, url } = props;

  const isContentTypeImage = image && isImage(image.contentType);

  if (isLoaded && !(title && domain)) {
    return null;
  }

  const isLoading = !isLoaded;

  const dataToRender = image?.data
    ? `data:image/jpeg;base64, ${fromArrayBufferToBase64(image?.data)}`
    : '';

  return (
    <StyledStagedLinkPreview
      container={true}
      justifyContent={isLoading ? 'center' : 'space-between'}
      alignItems="center"
      width={'100%'}
      padding={'var(--margins-md)'}
    >
      <Flex
        container={true}
        justifyContent={isLoading ? 'center' : 'flex-start'}
        alignItems={'center'}
      >
        {isLoading ? <SessionSpinner loading={isLoading} /> : null}
        {isLoaded && image && isContentTypeImage ? (
          <StyledImage>
            <Image
              alt={window.i18n('stagedPreviewThumbnail', [domain || ''])}
              attachment={image as any}
              height={100}
              width={100}
              url={dataToRender}
              softCorners={true}
            />
          </StyledImage>
        ) : null}
        {isLoaded ? <StyledText>{title}</StyledText> : null}
      </Flex>
      <SessionIconButton
        iconType="exit"
        iconColor="var(--chat-buttons-icon-color)"
        iconSize="small"
        onClick={() => {
          onClose(url || '');
        }}
        margin={'0 var(--margins-sm) 0 0'}
        aria-label={window.i18n('close')}
        style={{
          position: isLoading ? 'absolute' : undefined,
          right: isLoading ? 'var(--margins-sm)' : undefined,
        }}
      />
    </StyledStagedLinkPreview>
  );
};
