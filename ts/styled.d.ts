import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    common: {
      fonts: {
        sessionFontDefault: string;
        sessionFontAccent: string;
        sessionFontMono: string;
        xs: string;
        sm: string;
        md: string;
        lg: string;
        xl: string;
      };
      margins: {
        xs: string;
        sm: string;
        md: string;
        lg: string;
      };
      animations: {
        defaultDuration: string;
      };
    };
    colors: {
      accent: string;
      accentButton: string;
      destructive: string;
      cellBackground: string;
      modalBackground: string;
      fakeChatBubbleBackground: string;
      // input
      inputBackground: string;
      // text
      textColor: string;
      textColorSubtle: string;
      textColorSubtleNoOpacity: string;
      textColorOpposite: string;
      textHighlight: string;
      // inbox
      inboxBackground: string;
      // buttons
      backgroundPrimary: string;
      foregroundPrimary: string;
      buttonGreen: string;
      // conversation view
      composeViewBackground: string;
      composeViewTextFieldBackground: string;
      receivedMessageBackground: string;
      sentMessageBackground: string;
      receivedMessageText: string;
      sentMessageText: string;
      sessionShadow: string;
      sessionShadowColor: string;
      // left pane
      conversationList: string;
      conversationItemHasUnread: string;
      conversationItemSelected: string;
      clickableHovered: string;
      sessionBorder: string;
      sessionUnreadBorder: string;
      leftpaneOverlayBackground: string;
      // scrollbars
      scrollBarTrack: string;
      scrollBarThumb: string;
      // pill divider:
      pillDividerColor: string;
      pillDividerTextColor: string;
      // context menu
      contextMenuBackground: string;
      filterSessionText: string;
      lastSeenIndicatorColor: string;
      lastSeenIndicatorTextColor: string;
      quoteBottomBarBackground: string;
    };
  }
}
