# Contributing

## Never commit curriculum files

This repository is public (GitHub Pages requires it on a free account). Every PDF
under `Hillsdale/`, or any curriculum material added later (Math-U-See, Answers in
Genesis, Core Knowledge, etc.), is copyrighted third-party content. Committing it
here would republish it to the world.

- `*.pdf` is excluded in `.gitignore` — do not force-add PDFs with `git add -f`.
- All curriculum lives in **Firebase Storage** under `/curriculum/{subject}/{grade}/`,
  served through signed URLs and gated by Storage security rules so only
  authenticated family accounts can read them. Answer keys live under `/keys/`
  with a rule that denies all student reads.
- This repo contains **application code only** — frontend, Cloud Functions,
  Firestore/Storage rules, and their tests. No curriculum content, no scans,
  no answer keys.

If you're not sure whether a file is curriculum content, don't commit it — ask first.
