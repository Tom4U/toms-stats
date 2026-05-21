# Changelog

## [0.4.2](https://github.com/Tom4U/toms-stats/compare/toms-stats-v0.4.1...toms-stats-v0.4.2) (2026-05-21)


### Bug Fixes

* **ci:** use PAT for release-please to trigger downstream CI ([#59](https://github.com/Tom4U/toms-stats/issues/59)) ([7adcebd](https://github.com/Tom4U/toms-stats/commit/7adcebdb848bcbb82741abc897d7000d7aaeb6f3))
* **deploy:** deploy Cloud Functions alongside Hosting ([#56](https://github.com/Tom4U/toms-stats/issues/56)) ([cd336cb](https://github.com/Tom4U/toms-stats/commit/cd336cb3d3d37f4a4efd9717732d29a4d3fd2567))

## [0.4.1](https://github.com/Tom4U/toms-stats/compare/toms-stats-v0.4.0...toms-stats-v0.4.1) (2026-05-21)


### Bug Fixes

* **ci:** pass base_ref fallback for push-triggered spec-coupling gate ([#55](https://github.com/Tom4U/toms-stats/issues/55)) ([3ac8fe2](https://github.com/Tom4U/toms-stats/commit/3ac8fe2bdce6c89f655214552461ba761704609b))
* **deploy:** inject VITE_FIREBASE_* vars into dashboard build step ([#52](https://github.com/Tom4U/toms-stats/issues/52)) ([17535ad](https://github.com/Tom4U/toms-stats/commit/17535adee67d88b7fe852a292243fec5a37c44d2))

## [0.4.0](https://github.com/Tom4U/toms-stats/compare/toms-stats-v0.3.0...toms-stats-v0.4.0) (2026-05-21)


### Features

* **dashboard:** implement dashboard UI (AC-02-01..AC-02-08, closes [#21](https://github.com/Tom4U/toms-stats/issues/21)) ([#47](https://github.com/Tom4U/toms-stats/issues/47)) ([dd8686b](https://github.com/Tom4U/toms-stats/commit/dd8686bc3db17881e567cd69a59b36a04965e8c9))

## [0.3.0](https://github.com/Tom4U/toms-stats/compare/toms-stats-v0.2.0...toms-stats-v0.3.0) (2026-05-21)

### Features

- **auth:** Firebase Google sign-in and owner-UID authorisation ([#33](https://github.com/Tom4U/toms-stats/issues/33)) ([d49bb7c](https://github.com/Tom4U/toms-stats/commit/d49bb7cbdc57cb2a234c375bcfd9f7e91938157b))
- **scripts:** add opt-in strict test/code commit-split gate (Gate 3) ([#39](https://github.com/Tom4U/toms-stats/issues/39)) ([7278f73](https://github.com/Tom4U/toms-stats/commit/7278f73fc93687a96a63b18d1b9ce3884fe42ffc))
- **scripts:** enforce test-change rationale in commit-msg hook ([#38](https://github.com/Tom4U/toms-stats/issues/38)) ([04b225b](https://github.com/Tom4U/toms-stats/commit/04b225bda3c23964a08e2b5f54092f239ea89d96))

### Bug Fixes

- **ci:** read draft status via REST, not workflow_run payload ([#45](https://github.com/Tom4U/toms-stats/issues/45)) ([9bcbc90](https://github.com/Tom4U/toms-stats/commit/9bcbc90998c8e66ff4df372bf058cd9303f490c1))

## [0.2.0](https://github.com/Tom4U/toms-stats/compare/toms-stats-v0.1.1...toms-stats-v0.2.0) (2026-05-16)

### Features

- **tracker:** implement GET /api/stats endpoint ([#28](https://github.com/Tom4U/toms-stats/issues/28)) ([ffb84ab](https://github.com/Tom4U/toms-stats/commit/ffb84ab59070be3e25bb14c4c4f0dcf5ac2088af))

## [0.1.1](https://github.com/Tom4U/toms-stats/compare/toms-stats-v0.1.0...toms-stats-v0.1.1) (2026-05-15)

### Bug Fixes

- **ci:** build shared package before tracker in sonar-main workflow ([#12](https://github.com/Tom4U/toms-stats/issues/12)) ([bd0907d](https://github.com/Tom4U/toms-stats/commit/bd0907de666dba25ed1b5415560b98ca73505e0f))
