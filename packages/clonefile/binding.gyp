{
  "conditions": [
    ["OS=='mac'", {
      "targets": [{
        "target_name": "clonefile",
        "dependencies": [
          "<!(node -p \"require('node-addon-api').targets\"):node_addon_api",
        ],
        "sources": [
          "addon.cc",
        ],
        "cflags+": ["-fvisibility=hidden"],
        "xcode_settings": {
          "MACOSX_DEPLOYMENT_TARGET": "13",
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
