{
  "targets": [
    {
      "target_name": "geodesic_addon",
      "sources": [
        "geodesic_addon.cpp",
        "geodesic.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [ "NAPI_CPP_EXCEPTIONS" ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "conditions": [
        [ "OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalOptions": [ "/std:c++17", "/EHsc" ]
            }
          }
        } ],
        [ "OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "CLANG_CXX_LIBRARY": "libc++"
          }
        } ],
        [ "OS=='linux'", {
          "cflags_cc": [
            "-std=c++17",
            "-fexceptions",
            "-Wno-class-memaccess"
          ]
        } ]
      ]
    }
  ]
}
