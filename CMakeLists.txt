cmake_minimum_required(VERSION 3.13)
project(mp4)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fpermissive")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fpermissive")
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -lpthread")

add_executable(mp4
  src/mp4.cpp
)

target_include_directories(mp4 PRIVATE
  "src/minimp4"
)

if(EMSCRIPTEN)
    set(CMAKE_CXX_FLAGS "\
        ${CMAKE_CXX_FLAGS}\
        -s ALLOW_MEMORY_GROWTH=1\
        -s DISABLE_EXCEPTION_CATCHING=1\
        -s WASM=1\
        -s IGNORE_MISSING_MAIN\
        -s TEXTDECODER=0\
        -s MODULARIZE=1\
        -s FILESYSTEM=0\
        -s ASSERTIONS=0\
        -Wno-invalid-source-encoding\
        -Wno-tautological-pointer-compare\
        --pre-js ../src/pre.js\
        --extern-post-js ../src/extern-post.js\
        -O3\
        --closure 0\
        -g0\
        --bind\
    ")

    target_compile_options(mp4
      PRIVATE $<$<COMPILE_LANGUAGE:CXX>:-fno-exceptions>
    )
    
    option(WEB "Use Web Env" OFF)

    if (WEB)
      set(CMAKE_CXX_FLAGS "\
          ${CMAKE_CXX_FLAGS}\
          -s EXPORT_ES6=1\
          -s ENVIRONMENT=web,worker\
      ")
      set_target_properties(
          mp4
          PROPERTIES
              SUFFIX ".js"
      )
    else ()
      set(CMAKE_CXX_FLAGS "\
          ${CMAKE_CXX_FLAGS}\
          -s EXPORT_ES6=0\
          -s ENVIRONMENT=node\
      ")
      set_target_properties(
          mp4
          PROPERTIES
              SUFFIX ".node.js"
      )
    endif(WEB)

    unset(WEB CACHE)
endif()
