// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useSelector } from 'react-redux';
import { getHasPanelOpen } from '../state/selectors/nav.std.ts';
import { isShowingAnyModal } from '../state/selectors/globalModals.std.ts';
import { getIsInFullScreenCall } from '../state/selectors/isInFullScreenCall.std.ts';
import { useFunContextIsAnyOpen } from '../components/fun/FunProvider.dom.tsx';
import { shouldShowLightbox } from '../state/selectors/lightbox.std.ts';

export function getControlOrAltKey(): string {
  return window.platform === 'darwin' ? 'Control' : 'Alt';
}

export function useHasAnyOverlay(): boolean {
  const panels = useSelector(getHasPanelOpen);
  const globalModal = useSelector(isShowingAnyModal);
  const lightbox = useSelector(shouldShowLightbox);
  const calling = useSelector(getIsInFullScreenCall);
  const funOverlayOpen = useFunContextIsAnyOpen();
  return panels || globalModal || lightbox || calling || funOverlayOpen;
}

export function isKeyboardActivation(event: KeyboardEvent): boolean {
  if (
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    (event.key === 'Enter' || event.key === ' ')
  ) {
    return true;
  }

  return false;
}
