{
  "targets": [{
    "target_name": "translate_addon",
    "conditions": [
      ['OS=="mac"', {
        "sources": [
          "translate_addon.mm",
          "TranslateBridge.m",
          "TranslateCode.swift",
          "TranslateSession.swift"
        ],
        "include_dirs": [
          "<!@(node -p \"require('node-addon-api').include\")",
          ".",
          "build_swift"
        ],
        "dependencies": [
          "<!(node -p \"require('node-addon-api').gyp\")"
        ],
        "libraries": [
          "<(PRODUCT_DIR)/libTranslateCode.a"
        ],
        "cflags!": [ "-fno-exceptions" ],
        "cflags_cc!": [ "-fno-exceptions" ],
        "xcode_settings": {
          "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
          "CLANG_CXX_LIBRARY": "libc++",
          "MACOSX_DEPLOYMENT_TARGET": "15.0",
          "OTHER_LDFLAGS": ["-Wl,-rpath,@loader_path"]
        },
        "actions": [
          {
            "action_name": "build_swift",
            "inputs": [
              "TranslateCode.swift",
              "TranslateSession.swift"
            ],
            "outputs": [
              "build_swift/libTranslateCode.a",
              "build_swift/translate_addon-Swift.h"
            ],
            "action": [
              "swiftc",
              "TranslateCode.swift",
              "TranslateSession.swift",
              "-emit-objc-header-path", "./build_swift/translate_addon-Swift.h",
              "-emit-library", "-o", "./build_swift/libTranslateCode.a",
              "-emit-module", "-module-name", "translate_addon",
              "-module-link-name", "TranslateCode",
              "-target", "<!(node -p \"process.arch === 'arm64' ? 'arm64-apple-macosx15.0' : 'x86_64-apple-macosx15.0'\")"
            ]
          },
          {
            "action_name": "copy_swift_lib",
            "inputs": [
              "build_swift/libTranslateCode.a"
            ],
            "outputs": [
              "<(PRODUCT_DIR)/libTranslateCode.a"
            ],
            "action": [
              "sh",
              "-c",
              "cp -f \"<(module_root_dir)/build_swift/libTranslateCode.a\" \"<(PRODUCT_DIR)/libTranslateCode.a\" && install_name_tool -id @rpath/libTranslateCode.a \"<(PRODUCT_DIR)/libTranslateCode.a\""
            ]
          }
        ]
      }]
    ]
  }]
}
