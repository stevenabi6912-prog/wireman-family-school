# Wireman Family School Platform

Homeschool platform for four students (Luke, Layla, Logan, Lazarus) and one parent
(Abi). Static React frontend on GitHub Pages; Firestore, Auth, Storage, and Cloud
Functions on Firebase. See [docs/data-model.md](docs/data-model.md) for the schema
and [content-inventory.md](content-inventory.md) (gitignored, local only) for what
curriculum content exists so far.

## Repo layout

```
app/         React + Vite frontend (deployed to GitHub Pages)
functions/   Firebase Cloud Functions (grading pipeline, daily email, etc.)
scripts/     One-time admin scripts (e.g. seeding the 5 family accounts)
test/rules/  Firestore + Storage security rules tests (run against the emulator)
docs/        Data model and other reference docs
firestore.rules, storage.rules, firebase.json, .firebaserc
```

## One-time setup (needs your action — I can't do these for you)

1. **Create a Firebase project** at https://console.firebase.google.com, and
   **upgrade it to the Blaze (pay-as-you-go) plan** — required for Cloud Functions
   and outbound calls to the Anthropic API.
2. In the new project, enable: **Authentication** (Email/Password provider —
   this is what powers the username+PIN login under the hood), **Firestore**,
   **Storage**.
3. Put the project's ID into `.firebaserc` (replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID`).
4. Get the web app config from Project Settings > General > Your apps, and copy
   `app/.env.example` to `app/.env.local`, filling in the values.
5. Run `firebase login` (interactive — needs a browser, so run this yourself in
   a terminal) and then `firebase deploy --only firestore:rules,storage` from
   the repo root to publish the security rules.
6. Set the Anthropic key as a Functions secret (never as a frontend env var):
   `firebase functions:secrets:set ANTHROPIC_API_KEY`
7. Create the 5 family accounts (4 students + Abi) with custom claims:
   ```
   LUKE_PIN=<6 digits> LAYLA_PIN=<6 digits> LOGAN_PIN=<6 digits> \
   LAZARUS_PIN=<6 digits> ABI_PIN=<8+ digits> npm run seed:users
   ```
   Pick real PINs yourself — don't paste them into chat with me (see CONTRIBUTING.md
   note on secrets). This only needs to be run once per environment (again against
   the emulator suite for local dev, and again for the live project).
8. **Create the GitHub repo**, push this code, then enable **GitHub Pages**
   (Settings > Pages > Source: GitHub Actions) and add the six `VITE_FIREBASE_*`
   values as repository secrets (Settings > Secrets and variables > Actions) so
   `.github/workflows/deploy.yml` can build with them.

## Local development

```bash
npm install                      # root: rules-testing + admin tooling
cd app && npm install             # frontend deps

# Terminal 1 — emulators
npm run emulators                 # from repo root

# Terminal 2 — frontend, pointed at the emulators
cd app
cp .env.example .env.local        # set VITE_USE_FIREBASE_EMULATORS=true
npm run dev
```

## Tests

```bash
npm run test:rules   # Firestore + Storage security rules, against the emulator
```
