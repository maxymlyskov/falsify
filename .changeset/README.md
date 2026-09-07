# Changesets

Every user-visible change adds a file here: `npx changeset` (or write one by hand — a frontmatter with
`"burden": patch | minor | major` and one paragraph of what changed and why). Release: `npx changeset
version` bumps `package.json` and `.claude-plugin/plugin.json`, regenerates `CHANGELOG.md`; then tag.

Until v0.1.0 the version stays 0.0.0 and changesets accumulate.
