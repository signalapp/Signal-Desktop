import { CSSProperties } from 'styled-components';

export const MessageView = () => {
  const noDragStyle = { '-webkit-user-drag': 'none' } as CSSProperties;

  return (
    <div className="conversation placeholder">
      <div className="conversation-header" />
      <div className="container">
        <div className="content session-full-logo">
          <img
            src="images/session/brand.svg"
            className="session-brand-logo"
            alt="full-brand-logo"
            style={noDragStyle}
          />
          <img
            src="images/session/session-text.svg"
            className="session-text-logo"
            alt="full-brand-logo"
            style={noDragStyle}
          />
        </div>
      </div>
    </div>
  );
};
