---
name: address-pr-feedback
description: Fetch PR review comments, triage and fix feedback (AI review bots first, then humans), reply/resolve threads, and record durable lessons. Use when the user runs /address-pr-feedback, asks to address PR comments, fix Greptile/Bugbot/review feedback, or resolve review threads on a pull request.
---

# /address-pr-feedback

Address open pull request review feedback: bots first, then humans. Fix straightforward items immediately; confirm with the operator when the change is ambiguous or large. Capture durable lessons so future agents avoid the same mistakes.

Works in Cursor, Claude Code, and other Agent Skills–compatible tools via `/address-pr-feedback`.

## When to run

- User invokes `/address-pr-feedback`
- User asks to address PR comments, Greptile/Bugbot/review bot feedback, or resolve review threads
- After a review bot posts on the active PR and the user wants fixes applied

## Where this skill lives

Canonical project copy (edit this one in git):

- `.claude/skills/address-pr-feedback/SKILL.md`

Mirrored for other clients (keep in sync when editing):

- `.cursor/skills/address-pr-feedback` → symlink to the `.claude` copy (Cursor)
- Personal Cursor Agent Store: `skills/address-pr-feedback/`
- Personal Claude Code: `~/.claude/skills/address-pr-feedback/`

## Workflow

Copy and track:

```
PR feedback progress:
- [ ] 1. Resolve the PR
- [ ] 2. Collect review comments
- [ ] 3. Triage (bots → humans)
- [ ] 4. Implement fixes
- [ ] 5. Reply / resolve threads
- [ ] 6. Record durable lessons
- [ ] 7. Commit, push, summarize
```

### 1. Resolve the PR

1. If the user gave a PR URL or number, use that
2. Else use the open PR for the current branch (`gh pr view` or the host’s PR tooling)
3. If none / ambiguous, ask which PR

Stay on that PR’s head branch. Do not switch branches unless required to match the PR.

### 2. Collect review comments

Gather **unresolved** (or still-open) review comments and review bodies:

- Inline review comments and threads
- Top-level review summaries that request changes
- Skip outdated threads that no longer apply to the diff (note them briefly)

Use `gh` / GitHub APIs (or the host agent’s PR tools) to list comments. Prefer the same host’s supported path to reply and resolve; do not assume every environment allows `gh` mutations.

### 3. Triage (bots → humans)

**Order:** AI review bots first, then human reviewers.

Treat as bots when the author looks like an automated reviewer, including (non-exhaustive): Greptile, Bugbot / Cursor Bugbot, CodeRabbit, Copilot review bots, similar `*[bot]` accounts.

For each item, classify:

| Class | Action |
|-------|--------|
| Straightforward bug, safety gap, clear nit with an obvious fix | Fix now |
| Ambiguous intent, large redesign, product tradeoff, or disagrees with `docs/AGENT_CONTEXT.md` | Ask the operator before changing code |
| Wrong / obsolete / already fixed | Explain; do not “fix” noise |
| Human request that needs a product call | Ask before implementing |

Also respect repo non-negotiables (emulators-only local default, no secrets, AuthZ, sanitized errors). Do not apply bot advice that weakens those.

Batch confirmation questions when several items need operator input. Do not block the whole run on one ambiguous item if other straightforward fixes are ready.

### 4. Implement fixes

- Smallest task-scoped diff that addresses the feedback
- Match existing Prettier/ESLint/Tailwind/shadcn patterns
- Add or update tests when the feedback touches pure logic already covered by tests
- Do not expand into unrelated refactors

### 5. Reply / resolve threads

After a fix lands (or after deciding no code change):

| Author | Reply | Resolve |
|--------|-------|---------|
| Bot | Short note of what changed (or why not) | **Yes**, once addressed or intentionally declined with reason |
| Human | Short note of what changed (or clarifying question) | **Only** if the operator explicitly asked to resolve |

Never resolve a human thread by default.

### 6. Record durable lessons

When feedback caught a **real** bug, safety gap, or improvement that slipped past normal coding — and the lesson will help future agents — append to [`docs/AGENT_LESSONS.md`](../../../docs/AGENT_LESSONS.md).

Do **not** log one-off typos, pure style nits, or PR-specific noise.

If the lesson hardens into a standing rule, also update `docs/AGENT_CONTEXT.md` (and `.greptile/` when it is a review-severity rule). Prefer promoting repeated lessons into `AGENT_CONTEXT.md` rather than leaving them only in the lessons log.

Entry shape (append under Lessons):

```markdown
### YYYY-MM-DD — short title

- **Source:** PR #N · Greptile | Bugbot | human:@login
- **Gap:** what slipped past
- **Going forward:** concrete rule or check
- **Pointers:** `path/` or pattern to remember
```

### 7. Commit, push, summarize

1. Commit with a clear message focused on the feedback addressed
2. Push the PR branch
3. Reply to the operator with: PR link, items fixed, items skipped/declined, items waiting on confirmation, lessons appended (if any)

## Anti-patterns

- Resolving human comments without an explicit ask
- Blindly applying every bot suggestion (especially if it fights AuthZ, emulators-only, or sanitize-error rules)
- Huge refactors justified as “addressing review”
- Skipping `AGENT_LESSONS.md` when a real recurring gap was found
- Updating only one skill mirror (edit the `.claude/skills/` copy, then sync personal mirrors)

## Skill chain

```
/start → … implement on a PR …
/address-pr-feedback → fix review threads + lessons
/handoff → (optional) refresh feature plan if the PR is feature work
```
