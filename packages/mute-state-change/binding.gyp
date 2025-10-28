{
  "conditions": [
    ["OS=='mac'", {
      "targets": [{
        "target_name": "mute-state-change",
        "dependencies": [
          "<!(node -p \"require('node-addon-api').targets\"):node_addon_api",
        ],
        "sources": [
          "addon.mm",
        ],
        "libraries": [
          "-framework AVFAudio",
        ],
        "cflags+": ["-fvisibility=hidden"],
        "xcode_settings": {
          "CLANG_ENABLE_OBJC_ARC": "YES",
          "GCC_SYMBOLS_PRIVATE_EXTERN": "YES", # -fvisibility=hidden
          "LLVM_LTO": "YES",
        }
      }],
    }, {
      "targets": [{
        "target_name": "noop",
        "type": "none",
      }],
    }],
  ],
}
