# Changelog

## [4.0.0](https://github.com/JerrettDavis/ClaudeUsageDashboard/compare/v3.0.2...v4.0.0) (2026-02-06)


### ⚠ BREAKING CHANGES

* Replaces Electron with a minimal Rust launcher (~5MB vs ~100MB)
* Release artifacts now include native installers instead of Node.js archives

### Features

* add Clawdbot session file watching to real-time monitor ([aaf6fac](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/aaf6fac0e269d5922f02ba41bc01b9781e17fec9))
* add Clawdbot/OpenClaw provider for monitoring agent sessions ([ab05b7a](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/ab05b7ab05fbe97207dbc7ed4fe76e2f44863f60))
* add Electron desktop app for double-click installation ([f46e673](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/f46e67328ba2af35ade97ec623a3822bfec7ff0a))
* add release workflow with Docker and standalone builds ([8214f1f](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/8214f1f2c7897b8326135c198b25ca0100f06868))
* auto-initialize database and register Claude provider on startup ([f51c86b](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/f51c86b90bf1867d564bf4a5248c70c0609e73d2))
* lightweight Rust launcher with bundled Node.js ([ef5772e](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/ef5772e7a65dbee1e03b387f04912bdb9d9859fd))
* make tiling monitor default view, add navigation, enable auto-open ([55d2799](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/55d2799879b2e93f3e54b91b7002c227f787ff58))
* support Clawdbot message format in terminal formatter ([b3bcd6b](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/b3bcd6bf688b5535a069a897ab4554803f3d3701))
* switch to lightweight Rust launcher ([4148ec5](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/4148ec5c006c7383bade4e04e917a78957ee0c93))
* switch to Tauri for proper desktop window ([d5e6f2f](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/d5e6f2ff6bfaf472658b2b6c9c6b5d0a8861c34c))


### Bug Fixes

* add -Force to Windows copy operations ([10e9ff6](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/10e9ff6726f7c5b189607e412bb0939171f0492d))
* allow workflow dispatch with always() condition ([f547697](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/f547697a064610eddeaa9a01199a67784f88d1b6))
* clean dev artifacts from release package ([15e2bd7](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/15e2bd7b64d14942cc65265e432355414bb2b7cf))
* configure Tauri to bundle server as resources ([f5e8d44](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/f5e8d4410777eac1b18b32a3638bb12e7069c63c))
* correct Rust toolchain action name ([3117eef](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/3117eef70673111b18c3d4e6c9502bdb65899c28))
* correct status type in clawdbot provider ([f1476f0](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/f1476f0a24922a0569de9177f8de92131c0af6d5))
* create directories before copying files ([fe834a3](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/fe834a31a3ad6900bc45248afa0e9522a1da71c3))
* generate both icon.png and icon.ico on all platforms ([0d15412](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/0d154126b7e8013b656e602ae615c11fd2da43c1))
* generate icon.ico for Windows ([921d0ab](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/921d0ab557d004100735a611576e04c5d353ea4c))
* hide Node.js console window on Windows ([7c1376f](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/7c1376f2ea61a8417de51716287c00129f32c1f5))
* install librsvg2-bin for rsvg-convert on Linux ([df5e05b](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/df5e05b8ce43cc22b3cd754ab4e956acd99878c8))
* manual packaging instead of Tauri bundler (WiX timeout) ([d61c173](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/d61c1733ac567c2093ebe068b19e0b447a88f373))
* map toolResult role to assistant for DB compatibility ([3957e68](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/3957e68804303d001455b83f423abbe9a54bc3f5))
* remove deprecated instrumentationHook config (auto in Next.js 15) ([485cd5f](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/485cd5f10e7fce3173d0ce87fc1ae7c3246d6883))
* remove invalid telemetry config option ([ca71e7c](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/ca71e7cd92f65d2ec7c135e92378e9b7004261c4))
* remove Tauri references from build.rs ([4fca123](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/4fca123337cbb84ed3abcaaa0630ee71587b61dd))
* run tests serially to avoid SQLite locking ([31c1570](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/31c15703a586a354caed034b895c34a4686eac6e))
* search both Claude and Clawdbot directories for session history ([77533b8](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/77533b85069f6e224e22da7503be3af548bd6dba))
* simplify icon generation for cross-platform ([3c90ae9](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/3c90ae927312f306a4d999204141b2831a608045))
* TypeScript strict null checks in message formatter ([7bd49a2](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/7bd49a296f26e0f912e32bcad76d8d4976ec1415))
* update release workflow for manual triggers ([d40823e](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/d40823ede25e4e35940d23055aca476cf5085c92))
* upload directly to release (no artifact step) ([128dd62](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/128dd62514453e73852efff80940edac02fcdb87))
* use fileParallelism instead of poolOptions ([96b9757](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/96b9757eaf960d978790f661753e933094e9776a))
* use SessionMessage type in formatMessagesWithTimestamps ([2c2ddb2](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/2c2ddb2e4994e705193badd6eb22b6bc9e2915c1))
* Windows packaging recursive copy ([8b6841e](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/8b6841ee039168b04c84fe318eb3f87291a84c1b))

## [3.0.2](https://github.com/JerrettDavis/ClaudeUsageDashboard/compare/v3.0.1...v3.0.2) (2026-02-05)


### Bug Fixes

* remove Tauri references from build.rs ([4fca123](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/4fca123337cbb84ed3abcaaa0630ee71587b61dd))

## [3.0.1](https://github.com/JerrettDavis/ClaudeUsageDashboard/compare/v3.0.0...v3.0.1) (2026-02-05)


### Bug Fixes

* correct Rust toolchain action name ([3117eef](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/3117eef70673111b18c3d4e6c9502bdb65899c28))

## [3.0.0](https://github.com/JerrettDavis/ClaudeUsageDashboard/compare/v2.0.0...v3.0.0) (2026-02-05)


### ⚠ BREAKING CHANGES

* Replaces Electron with a minimal Rust launcher (~5MB vs ~100MB)

### Features

* switch to lightweight Rust launcher ([4148ec5](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/4148ec5c006c7383bade4e04e917a78957ee0c93))

## [2.0.0](https://github.com/JerrettDavis/ClaudeUsageDashboard/compare/v1.0.0...v2.0.0) (2026-02-05)


### ⚠ BREAKING CHANGES

* Release artifacts now include native installers instead of Node.js archives

### Features

* add Electron desktop app for double-click installation ([f46e673](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/f46e67328ba2af35ade97ec623a3822bfec7ff0a))

## 1.0.0 (2026-02-05)


### Features

* add release workflow with Docker and standalone builds ([8214f1f](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/8214f1f2c7897b8326135c198b25ca0100f06868))


### Bug Fixes

* remove invalid telemetry config option ([ca71e7c](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/ca71e7cd92f65d2ec7c135e92378e9b7004261c4))
* run tests serially to avoid SQLite locking ([31c1570](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/31c15703a586a354caed034b895c34a4686eac6e))
* use fileParallelism instead of poolOptions ([96b9757](https://github.com/JerrettDavis/ClaudeUsageDashboard/commit/96b9757eaf960d978790f661753e933094e9776a))
