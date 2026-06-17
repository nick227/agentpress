# Authentication and Permissions / Roles Spec

## MVP auth stance

MVP can start with a single signed-in owner/admin role. Do not overbuild roles until collaboration exists.

## Suggested roles

### Owner

Full access to all accounts, pipelines, destinations, runs, and settings.

### Admin / Editor, future

Can create/edit accounts and pipelines, run pipelines, and publish.

### Viewer, future

Can view accounts, pipelines, and run outputs, but cannot edit or publish.

## MVP permission matrix

| Action | Owner |
|---|---:|
| Create account | Yes |
| Edit account | Yes |
| Delete account | Yes |
| Create pipeline | Yes |
| Edit pipeline | Yes |
| Delete pipeline | Yes |
| Run dry pipeline | Yes |
| Run live pipeline | Yes |
| Configure destination | Yes |
| View run outputs | Yes |
| Download run assets | Yes |

## Authentication options

Recommended MVP:

- Email/password or magic link
- Session cookie
- Server-side session storage

Fast local/dev fallback:

- Single dev user via environment variable

## Secrets

WordPress credentials and API keys must not be stored in plain text.

Store:

- Encrypted secret reference
- Never return secret value from API after creation
- Allow replace/reconnect

## Safety rules

- Dry run must override destination publishing.
- Paused pipeline must not run on schedule.
- Live publishing should require destination configured and valid.
- Delete account should be protected by confirmation because it owns pipelines and runs.
