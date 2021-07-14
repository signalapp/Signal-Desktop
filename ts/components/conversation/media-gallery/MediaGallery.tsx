import React, { useState } from 'react';
import classNames from 'classnames';

import { AttachmentSection } from './AttachmentSection';
import { EmptyState } from './EmptyState';
import { missingCaseError } from '../../../util/missingCaseError';

import { MediaItemType } from '../../LightboxGallery';
type Props = {
  documents: Array<MediaItemType>;
  media: Array<MediaItemType>;
};

type TabType = 'media' | 'documents';

const Tab = ({
  isSelected,
  label,
  onSelect,
  type,
}: {
  isSelected: boolean;
  label: string;
  onSelect: () => void;
  type: TabType;
}) => {
  return (
    <div
      className={classNames(
        'module-media-gallery__tab',
        isSelected ? 'module-media-gallery__tab--active' : null
      )}
      onClick={onSelect}
      role="tab"
    >
      {label}
    </div>
  );
};

const Sections = (props: Props & { selectedTab: TabType }) => {
  const { media, documents, selectedTab } = props;

  const mediaItems = selectedTab === 'media' ? media : documents;
  const type = selectedTab;

  if (!mediaItems || mediaItems.length === 0) {
    const label = (() => {
      switch (type) {
        case 'media':
          return window.i18n('mediaEmptyState');

        case 'documents':
          return window.i18n('documentsEmptyState');

        default:
          throw missingCaseError(type);
      }
    })();

    return <EmptyState data-test="EmptyState" label={label} />;
  }

  return (
    <div className="module-media-gallery__sections">
      <AttachmentSection key="mediaItems" type={type} mediaItems={mediaItems} />
    </div>
  );
};

export const MediaGallery = (props: Props) => {
  const [selectedTab, setSelectedTab] = useState<TabType>('media');

  const isDocumentSelected = selectedTab === 'documents';
  const isMediaSelected = selectedTab === 'media';

  return (
    <div className="module-media-gallery">
      <div className="module-media-gallery__tab-container">
        <Tab
          label={window.i18n('media')}
          type="media"
          isSelected={isMediaSelected}
          onSelect={() => {
            setSelectedTab('media');
          }}
        />
        <Tab
          label={window.i18n('documents')}
          type="documents"
          isSelected={isDocumentSelected}
          onSelect={() => {
            setSelectedTab('documents');
          }}
        />
      </div>
      <div className="module-media-gallery__content">
        <Sections {...props} selectedTab={selectedTab} />
      </div>
    </div>
  );
};
