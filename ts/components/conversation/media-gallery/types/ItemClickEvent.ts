import { MediaItemType } from '../../../LightboxGallery';

export interface ItemClickEvent {
  mediaItem: MediaItemType;
  type: 'media' | 'documents';
}
