# Changelog

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
