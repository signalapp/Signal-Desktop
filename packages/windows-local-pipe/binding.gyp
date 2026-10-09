{
  "conditions": [
    ["OS=='win'", {
      "targets": [{
        "target_name": "windows-local-pipe",
        # Include node-addon-api directly instead of depending on its gyp
        # target: that target writes node_addon_api.sln into the shared
        # node-addon-api folder, which races with windows-ucv's build when
        # electron-builder rebuilds native modules in parallel.
        "include_dirs": [
          "<!(node -p \"require('node-addon-api').include_dir\")",
        ],
        "sources": [
          "addon.cpp",
        ],
        "libraries": [
          "advapi32.lib",
        ],
        "defines": [
          "UNICODE",
          "_UNICODE",
          "WIN32_LEAN_AND_MEAN",
          "NOMINMAX",
          "NAPI_CPP_EXCEPTIONS",
        ],
        "msvs_settings": {
          "VCCLCompilerTool": {
            "ExceptionHandling": 1, # /EHsc,
            "RuntimeLibrary": "2", # /MD
          },
        },
      }],
    }, {
      "targets": [{
        "target_name": "noop",
        "type": "none",
      }],
    }],
  ],
}
