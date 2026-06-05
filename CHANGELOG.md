# Changelog

## [0.5.1](https://github.com/Tom4U/toms-stats/compare/toms-stats-v0.5.0...toms-stats-v0.5.1) (2026-06-05)


### Bug Fixes

* **ci:** run CodeQL on every PR so the code_scanning ruleset is satisfied ([#79](https://github.com/Tom4U/toms-stats/issues/79)) ([e6b031f](https://github.com/Tom4U/toms-stats/commit/e6b031fde146887b1b229fb3af2fe7fba039412e))
* **ci:** suffix real jobs with (run) so required checks resolve to one run ([#78](https://github.com/Tom4U/toms-stats/issues/78)) ([7b206dc](https://github.com/Tom4U/toms-stats/commit/7b206dce60470cb9b8c4caccf0bf85d1243ef943))
* **tracker:** declare VISITOR_SALT and OWNER_UID secrets on tracker function ([#74](https://github.com/Tom4U/toms-stats/issues/74)) ([26aba1f](https://github.com/Tom4U/toms-stats/commit/26aba1ff21561803160e0386c802c52c6a44148c))

## [0.5.0](https://github.com/Tom4U/toms-stats/compare/toms-stats-v0.4.3...toms-stats-v0.5.0) (2026-06-05)


### Features

* **tracker:** add /api/sites GET+POST handler and shared requireOwner ([#73](https://github.com/Tom4U/toms-stats/issues/73)) ([3a4da39](https://github.com/Tom4U/toms-stats/commit/3a4da39647819abab821b4d87c37c2e5d89eec95)), closes [#71](https://github.com/Tom4U/toms-stats/issues/71)
* **tracker:** add single `tracker` router for all /api/* routes ([#72](https://github.com/Tom4U/toms-stats/issues/72)) ([6a619dc](https://github.com/Tom4U/toms-stats/commit/6a619dcfdb89522d0cd4d7815098124bb7ab250f)), closes [#57](https://github.com/Tom4U/toms-stats/issues/57)


### Bug Fixes

* **ci:** use RELEASE_PLEASE_PAT for undraft GraphQL mutation in ci-ready workflow ([#70](https://github.com/Tom4U/toms-stats/issues/70)) ([c7de428](https://github.com/Tom4U/toms-stats/commit/c7de428b40f07b2a01ce5504f80b60d27c2e7ecc))
* **tracker:** explicitly declare Stryker plugins for pnpm compatibility ([#68](https://github.com/Tom4U/toms-stats/issues/68)) ([e47a25e](https://github.com/Tom4U/toms-stats/commit/e47a25e1e67d65310fc00afb7fdb82e9e67f9410))

## [0.4.3](https://github.com/Tom4U/toms-stats/compare/toms-stats-v0.4.2...toms-stats-v0.4.3) (2026-06-04)


### Bug Fixes

* **ci:** replace node_modules/.bin/firebase with pnpm exec ([#66](https://github.com/Tom4U/toms-stats/issues/66)) ([5ffbe42](https://github.com/Tom4U/toms-stats/commit/5ffbe4250a6bec2d6ca24ce1cdcf199f86db4855))

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
