# Release process

## Versioning and tags
Use semantic versioning with tags like v0.6.7. Hotfixes can use suffixes (v0.5.0a, v0.5.0b) when necessary.

## When to add migrations
Add a new migration file for any schema change. Do not edit historical migrations.

## Required checks
Run npm test, npm run lint, npm run typecheck, and npm run build before tagging.

## Documentation updates per release
Update CHANGELOG.md, docs/SMOKE_TESTS.md, and docs/ROADMAP.md as needed.

## Release steps
1. Apply or document any new migrations.
2. Update docs and ensure the README links remain current.
3. Run the required checks.
4. Commit with a clear versioned message.
5. Tag the release and push tags.
