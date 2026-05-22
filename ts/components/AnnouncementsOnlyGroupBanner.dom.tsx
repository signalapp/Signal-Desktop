// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, type JSX } from 'react';
import type { ShowConversationType } from '../state/ducks/conversations.preload.ts';
import { I18n } from './I18n.dom.tsx';
import type { LocalizerType, ThemeType } from '../types/Util.std.ts';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.ts';
import type { AdminMembershipType } from '../state/selectors/conversations.dom.ts';
import type { ContactNameColorType } from '../types/Colors.std.ts';
import { AnnouncementsOnlyGroupBannerAdminsDialog } from './AnnouncementsOnlyGroupBannerAdminsDialog.dom.tsx';

type AnnouncementsOnlyGroupBannerProps = Readonly<{
  getPreferredBadge: PreferredBadgeSelectorType;
  groupAdmins: Array<AdminMembershipType>;
  memberColors: Map<string, ContactNameColorType>;
  i18n: LocalizerType;
  showConversation: ShowConversationType;
  theme: ThemeType;
}>;

export function AnnouncementsOnlyGroupBanner(
  props: AnnouncementsOnlyGroupBannerProps
): JSX.Element {
  const { i18n } = props;
  const [isShowingAdmins, setIsShowingAdmins] = useState(false);
  return (
    <>
      <div className="AnnouncementsOnlyGroupBanner__banner">
        <I18n
          i18n={i18n}
          id="icu:AnnouncementsOnlyGroupBanner--announcements-only"
          components={{
            admins: (
              <button
                className="AnnouncementsOnlyGroupBanner__banner--admins"
                type="button"
                onClick={() => setIsShowingAdmins(true)}
              >
                {i18n('icu:AnnouncementsOnlyGroupBanner--admins')}
              </button>
            ),
          }}
        />
      </div>
      <AnnouncementsOnlyGroupBannerAdminsDialog
        i18n={i18n}
        open={isShowingAdmins}
        onOpenChange={setIsShowingAdmins}
        groupAdmins={props.groupAdmins}
        memberColors={props.memberColors}
        getPreferredBadge={props.getPreferredBadge}
        showConversation={props.showConversation}
        theme={props.theme}
      />
    </>
  );
}
