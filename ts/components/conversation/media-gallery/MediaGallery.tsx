import React from 'react';
import classNames from 'classnames';

import { AttachmentSection } from './AttachmentSection';
import { EmptyState } from './EmptyState';
import { ItemClickEvent } from './types/ItemClickEvent';
import { missingCaseError } from '../../../util/missingCaseError';

import { MediaItemType } from '../../LightboxGallery';

interface Props {
  documents: Array<MediaItemType>;
  media: Array<MediaItemType>;
  onItemClick?: (event: ItemClickEvent) => void;
}

interface State {
  selectedTab: 'media' | 'documents';
}

interface TabSelectEvent {
  type: 'media' | 'documents';
}

const Tab = ({
  isSelected,
  label,
  onSelect,
  type,
}: {
  isSelected: boolean;
  label: string;
  onSelect?: (event: TabSelectEvent) => void;
  type: 'media' | 'documents';
}) => {
  const handleClick = onSelect
    ? () => {
        onSelect({ type });
      }
    : undefined;

  return (
    <div
      className={classNames(
        'module-media-gallery__tab',
        isSelected ? 'module-media-gallery__tab--active' : null
      )}
      onClick={handleClick}
      role="tab"
    >
      {label}
    </div>
  );
};

export class MediaGallery extends React.Component<Props, State> {
  public state: State = {
    selectedTab: 'media',
  };

  public render() {
    const { selectedTab } = this.state;

    return (
      <div className="module-media-gallery">
        <div className="module-media-gallery__tab-container">
          <Tab
            label="Media"
            type="media"
            isSelected={selectedTab === 'media'}
            onSelect={this.handleTabSelect}
          />
          <Tab
            label="Documents"
            type="documents"
            isSelected={selectedTab === 'documents'}
            onSelect={this.handleTabSelect}
          />
        </div>
        <div className="module-media-gallery__content">
          {this.renderSections()}
        </div>
      </div>
    );
  }

  private readonly handleTabSelect = (event: TabSelectEvent): void => {
    this.setState({ selectedTab: event.type });
  };

  private renderSections() {
    const { media, documents, onItemClick } = this.props;
    const { selectedTab } = this.state;

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
        <AttachmentSection
          key="mediaItems"
          i18n={window.i18n}
          type={type}
          mediaItems={mediaItems}
          onItemClick={onItemClick}
        />
      </div>
    );
  }
}
