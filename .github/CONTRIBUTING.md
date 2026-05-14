# Contributing to toms-stats

## Branch Strategy — GitHub Flow

We use [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow):

| Branch | Purpose |
| --- | --- |
| `main` | Always deployable. Protected — push only via PR. |
| `feat/<name>` | New feature (e.g. `feat/track-event-handler`) |
| `fix/<name>` | Bug fix (e.g. `fix/visitor-hash-collision`) |
| `docs/<name>` | Documentation only |
| `chore/<name>` | Tooling, deps, config — no production code change |
| `refactor/<name>` | Restructuring without behaviour change |

### Typical workflow

```bash
# 1. Cut a branch from main
git switch main && git pull
git switch -c feat/my-feature

# 2. Implement (spec first, tests first — see CLAUDE.md)

# 3. Push and open a PR
git push -u origin feat/my-feature
gh pr create --fill

# 4. Address review, squash-merge to main
# 5. Delete the branch after merge
```

### Rules

- Every PR must reference the spec acceptance criterion it fulfils (e.g. `Closes AC-03`).
- Tests must pass in CI before merge.
- No direct pushes to `main`.
- Keep PRs focused — one feature / fix per PR.

## Spec Driven Development

A feature does not exist until a spec exists in `specs/`.
Changing a feature means updating the spec first.
See `specs/` and `CLAUDE.md` for the full process.

## Test Driven Development

1. Write a failing test that captures the acceptance criterion.
2. Write the minimum code to make it pass.
3. Refactor if needed — tests stay green.

Run tests locally before pushing:

```bash
# All workspaces
npm test

# With Firebase emulators (integration tests)
npx firebase emulators:exec "npm test"

# Dashboard component & Storybook tests
npm -w apps/dashboard run test:unit

# E2E
npm -w apps/dashboard run test:e2e
```

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(tracker): add hash-visitor function
fix(dashboard): correct bounce rate calculation
docs(specs): add AC-05 to tracking-api spec
chore(deps): bump firebase-admin to 13.9
```

## Code Style

- TypeScript strict, no `any`, explicit return types.
- Format with Prettier: `npm -w apps/dashboard run format`
- Lint: `npm -w apps/dashboard run lint`
- File length soft limit: ~200 lines — split if longer.
- Comments only for non-obvious WHY — never WHAT.
