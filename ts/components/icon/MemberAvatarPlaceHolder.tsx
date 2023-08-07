import React from 'react';

export const MemberAvatarPlaceHolder = () => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26">
      <circle fill="var(--primary-color)" cx="13" cy="13" r="13" />
      <path
        fill="var(--white-color)"
        d="M18.9 19.1c-1.5-.9-3-.8-3-.8h-3.6c-2.3 0-3.3 0-4.2.3-.9.3-1.8.8-2.8 2-.5.7-.8 1.4-1 2C6.6 24.7 9.7 26 13 26c3.3 0 6.4-1.3 8.7-3.3-.5-1.6-1.5-2.8-2.8-3.6z"
      />
      <ellipse cx="13" cy="10.8" fill="var(--white-color)" rx="5.6" ry="6.1" />
    </svg>
  );
};
