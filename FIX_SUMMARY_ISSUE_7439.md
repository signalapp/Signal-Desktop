# Fix Summary for GitHub Issue #7439: SQLCipher HMAC Check Failure

## Issue Description
Users experienced crashes on startup with the error:
```
ERROR CORE sqlcipher_page_cipher: hmac check failed for pgno=1
ERROR CORE sqlite3Codec: error decrypting page 1 data: 1
```

This occurred after:
- Upgrading Signal Desktop (e.g., from 7.63.0 to 7.64.0)
- System reboots
- KWallet backend changes on Linux systems

## Root Cause Analysis

The issue was in the `getSQLKey()` function in `app/main.main.ts` (around line 1650). The function calls `safeStorage.decryptString()` to decrypt the database encryption key, but this call was **not wrapped in a try-catch block**.

When decryption failed (due to KWallet issues, backend changes, or corrupted encrypted keys), one of two things happened:
1. An unhandled exception was thrown, causing the app to crash
2. Corrupted/garbage data was returned instead of the actual key

In both cases, the wrong key was used to open the SQLCipher database, resulting in the "hmac check failed" error because HMAC verification fails with an incorrect key.

## Solution Implemented

### Changes Made to `app/main.main.ts`

**Location**: `getSQLKey()` function, lines ~1641-1720

**Key Changes**:

1. **Added try-catch block around `safeStorage.decryptString()`**:
   - Catches any exceptions thrown during decryption
   - Logs detailed error information for debugging

2. **Added validation of decrypted key**:
   - Checks if the decrypted value is a valid string
   - Validates it's a proper 64-character hexadecimal string (32 bytes)
   - Throws an error if validation fails

3. **Implemented graceful fallback mechanism**:
   - If decryption fails and a legacy plaintext key exists, falls back to it
   - Invokes `handleSafeStorageDecryptionError()` to prompt the user
   - If user chooses to continue without a valid key, generates a new key (with data loss warning)

4. **Added decryption success tracking**:
   - Uses `decryptionSucceeded` flag to track whether decryption was successful
   - Only performs legacy key validation and backend saving if decryption succeeded
   - Prevents incorrect logic flow when using fallback keys

### Code Flow

```
1. Try to decrypt the encrypted key
   ├─ Success: Validate the decrypted key
   │  ├─ Valid: Use the key, mark decryptionSucceeded = true
   │  └─ Invalid: Throw error, go to catch block
   │
   └─ Failure (catch block):
      ├─ Legacy key exists?
      │  ├─ Yes: Prompt user, use legacy key as fallback
      │  └─ No: Prompt user, generate new key (data loss)
      │
      └─ User chose to quit? Throw SafeStorageDecryptionError

2. If decryption succeeded AND legacy key exists:
   └─ Compare keys, remove legacy if they match

3. If decryption succeeded AND on Linux AND first time:
   └─ Save the safeStorageBackend for future validation
```

## Benefits of This Fix

1. **Prevents crashes**: Gracefully handles decryption failures instead of crashing
2. **Better error messages**: Users get clear information about what went wrong
3. **Data recovery**: Falls back to legacy key when available, preventing data loss
4. **User control**: Prompts users before taking destructive actions
5. **Debugging**: Adds detailed logging for troubleshooting

## Testing Recommendations

### Manual Testing Scenarios

1. **Normal startup**: Verify app starts normally with valid encrypted key
2. **Corrupted encrypted key**: Test with invalid hex data in config
3. **Missing KWallet**: Test on Linux with KWallet unavailable
4. **Backend change**: Test with different `safeStorageBackend` values
5. **Legacy key fallback**: Test with both encrypted and legacy keys present
6. **First-time migration**: Test migration from legacy to encrypted key

### Automated Testing

The fix maintains backward compatibility and doesn't change the public API, so existing tests should continue to pass. Consider adding specific tests for:
- Decryption failure scenarios
- Key validation logic
- Fallback mechanism behavior

## Related Files

- `app/main.main.ts` - Main fix location
- `ts/types/SafeStorageDecryptionError.std.ts` - Error type used
- `ts/types/SafeStorageBackendChangeError.std.ts` - Related error type
- `ts/sql/Server.node.ts` - SQLCipher initialization (uses the key)

## Migration Notes

This fix is backward compatible and requires no migration steps. Users who experienced the crash should be able to:
1. Start Signal Desktop normally if they have a legacy key
2. Be prompted to handle the situation if no fallback is available
3. Continue using Signal with their existing data (if recovery is possible)

## Additional Improvements Considered

Future enhancements could include:
- Automatic backup of database before key changes
- More sophisticated key recovery mechanisms
- Better detection of KWallet/keyring issues before attempting decryption
- Telemetry to track how often this issue occurs in the wild
