# Little Stories

Little Stories is a mobile-first classroom photo-book creator for preschool teachers.

Its purpose is simple: turn a folder of classroom photos into a beautiful, printable classroom book with as little work as possible.

## Product principles

- Books, projects, and themes are the organizing unit — not students.
- The primary workflow is: Home → Name → Theme → Photos → Build → Your Book Is Ready → Edit → Preview/Print.
- The app is designed mobile-first for Android and installable as a PWA.
- Printed books target true US Letter portrait pages: 8.5 × 11 inches.
- Themes coordinate covers and inside pages while keeping classroom photographs dominant.
- Little Stories does the designing; the teacher makes simple choices.
- Data reliability, backup visibility, and recovery are first-class requirements.

## Initial architecture

The app will separate:

1. UI and navigation
2. Book/page/layout logic
3. Photo/media handling
4. IndexedDB persistence
5. Backup/recovery
6. Fixed-size print rendering
7. PWA installation/service worker behavior

## Data safety goals

- IndexedDB is the active working store, never the only copy.
- Photos are stored as Blob assets rather than base64 JSON.
- Autosave is continuous; no normal Save button is required.
- Saved and Backed Up are distinct states in the UI.
- Multi-record changes use transactions.
- Deleted books go to Recently Deleted before permanent deletion.
- Backups are self-contained and schema-versioned.
- Off-device backup is part of the long-term architecture.

## Printing goals

- A dedicated print renderer is separate from the responsive mobile editor.
- Each printable page is rendered at an exact physical size of 8.5 × 11 inches.
- Android/Chromium printing is tested early in development rather than treated as a final polish step.

## First functional milestone

Create a complete reliability loop:

- installable Little Stories PWA
- create a book
- name it
- choose a test theme
- import photos
- auto-build pages
- edit layouts/captions
- preview and print exact Letter pages
- close/reopen with all data intact
- export backup
- restore backup successfully

This repository is completely separate from Little Moments, including its codebase, storage names, PWA identity, service worker scope, icons, and backups.
