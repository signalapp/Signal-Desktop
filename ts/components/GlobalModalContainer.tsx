// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

type PropsType = {
  // ProfileEditor
  isProfileEditorVisible: boolean;
  renderProfileEditor: () => JSX.Element;
};

export const GlobalModalContainer = ({
  // ProfileEditor
  isProfileEditorVisible,
  renderProfileEditor,
}: PropsType): JSX.Element | null => {
  if (isProfileEditorVisible) {
    return renderProfileEditor();
  }

  return null;
};
