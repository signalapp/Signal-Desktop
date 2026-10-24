// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { AxoList } from '../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../axo/items/AxoItem.dom.tsx';
import { CallingDeviceSelectionItems } from './CallingDeviceSelectionItems.dom.tsx';

import type {
  AudioDevicePref,
  MediaDeviceSettingsRenderProps,
} from '../types/Calling.std.ts';

export type CallingDeviceSelectionProps = Readonly<
  MediaDeviceSettingsRenderProps & {
    i18n: LocalizerType;
    onClose: () => void;
    onSelectedCameraChange: (value: string) => void;
    onSelectedMicrophoneChange: (value: AudioDevicePref) => void;
    onSelectedSpeakerChange: (value: AudioDevicePref) => void;
  }
>;

export function CallingDeviceSelection(
  props: CallingDeviceSelectionProps
): ReactNode {
  const { i18n } = props;
  return (
    <AxoDialog.Root open onOpenChange={props.onClose}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:callingDeviceSelection__settings-v2')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body padding="md">
          <AxoList.Group>
            <AxoList.Root>
              <AxoList.Body>
                <AxoItem.Group>
                  <CallingDeviceSelectionItems
                    forceStackedLayout
                    availableCameras={props.availableCameras}
                    availableMicrophones={props.availableMicrophones}
                    availableSpeakers={props.availableSpeakers}
                    i18n={i18n}
                    selectedCamera={props.selectedCamera}
                    selectedMicrophone={props.selectedMicrophone}
                    selectedSpeaker={props.selectedSpeaker}
                    onSelectedCameraChange={props.onSelectedCameraChange}
                    onSelectedMicrophoneChange={
                      props.onSelectedMicrophoneChange
                    }
                    onSelectedSpeakerChange={props.onSelectedSpeakerChange}
                  />
                </AxoItem.Group>
              </AxoList.Body>
            </AxoList.Root>
          </AxoList.Group>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
