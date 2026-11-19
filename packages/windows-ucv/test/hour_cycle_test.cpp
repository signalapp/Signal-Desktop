// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

#include "../hour_cycle.h"

#include <assert.h>
#include <algorithm>
#include <iostream>

int main() {
  const struct {
    const wchar_t* format;
    const char* expected;
  } cases[] = {
      {L"h:mm tt", "12"},
      {L"hh:mm:ss tt", "12"},
      {L"H:mm", "24"},
      {L"HH:mm:ss", "24"},
      {L"tt h:mm", "12"},
      {L"h:mm tt 'H'", "12"},
      {L"'H' h:mm tt", "12"},
      {L"HH:mm 'h'", "24"},
      {L"h:mm 'o''clock H' tt", "12"},
      {L"HH:mm '' 'h'", "24"},
      {L"h:mm tt;HH:mm", "12"},
      {L"HH:mm;h:mm tt", "24"},
      {L"h:mm ';H' tt;HH:mm", "12"},
      {L"HH:mm;h:mm '", "24"},
      {L"", "unknown"},
      {L"mm:ss", "unknown"},
      {L"'HH:mm'", "unknown"},
      {L"h H:mm", "unknown"},
      {L"h:mm 'H", "unknown"},
      {L";HH:mm", "unknown"},
  };
  for (const auto& test : cases) {
    assert(std::string(ParseHourCyclePreference(test.format)) == test.expected);
  }

  // Simulate both API failures and a setting changing between the two calls.
  for (int failure = 0; failure <= 2; ++failure) {
    int calls = 0;
    const auto result = GetUserHourCyclePreference(
        [&](LPCWSTR locale, LCTYPE type, LPWSTR buffer, int size) -> int {
          assert(locale == LOCALE_NAME_USER_DEFAULT);
          assert(type == LOCALE_SSHORTTIME);  // User overrides must stay enabled.
          ++calls;
          if (calls == failure) {
            return 0;
          }
          if (buffer == nullptr) {
            assert(size == 0);
            return 32;
          }
          assert(size == 32);
          const std::wstring format = L"HH:mm";
          std::copy(format.begin(), format.end(), buffer);
          buffer[format.size()] = L'\0';
          return static_cast<int>(format.size() + 1);
        });
    assert(std::string(result) == (failure == 0 ? "24" : "unknown"));
    assert(calls == (failure == 1 ? 1 : 2));
  }

  // Exercise the real Windows query without modifying the machine's settings.
  const auto liveResult = GetUserHourCyclePreference(GetLocaleInfoEx);
  assert(std::string(liveResult) == "12" || std::string(liveResult) == "24" ||
         std::string(liveResult) == "unknown");
  std::cout << "Hour-cycle tests passed (20 patterns, 3 API scenarios). "
            << "Current Windows preference: " << liveResult << '\n';
}
