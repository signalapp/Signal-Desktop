// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

#pragma once

#include <windows.h>

#include <string>

inline const char* ParseHourCyclePreference(const std::wstring& format) {
  bool quoted = false;
  bool prefer12 = false;
  bool prefer24 = false;
  for (size_t i = 0; i < format.size(); ++i) {
    const auto ch = format[i];
    if (ch == L'\'') {
      if (i + 1 < format.size() && format[i + 1] == L'\'') {
        ++i;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted) {
      // Only the first (preferred) short-time format matters.
      if (ch == L';') {
        break;
      }
      prefer12 = prefer12 || ch == L'h';
      prefer24 = prefer24 || ch == L'H';
    }
  }
  if (quoted || prefer12 == prefer24) {
    return "unknown";
  }
  return prefer24 ? "24" : "12";
}

// Accept the API as an argument so failures can be tested without changing the
// user's Windows settings.
template <typename GetLocaleInfo>
inline const char* GetUserHourCyclePreference(GetLocaleInfo getLocaleInfo) {
  const int size = getLocaleInfo(LOCALE_NAME_USER_DEFAULT, LOCALE_SSHORTTIME,
                                nullptr, 0);
  if (size == 0) {
    return "unknown";
  }
  std::wstring format(size, L'\0');
  const int written = getLocaleInfo(LOCALE_NAME_USER_DEFAULT, LOCALE_SSHORTTIME,
                                   &format[0], size);
  if (written == 0) {
    return "unknown";
  }
  format.resize(written - 1);
  return ParseHourCyclePreference(format);
}
