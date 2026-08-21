# GIPO Account, Onboarding, and Personalization Design

**Author:** Manus AI  
**Status:** Approved design sections; pending user review of this written specification  
**Scope:** Phase 1 of the GIPO expansion

## 1. Purpose and Scope

GIPO will replace its magic-link-only entry screen with a conventional, secure account experience. New users will register with a display name, a unique public handle, an email address, a password, and a confirmation of that password. They must confirm their email address before they can complete onboarding, create a bot, or begin a story. Existing signed-in users will receive the same onboarding only when their profile is incomplete.

The phase adds a privacy-preserving 16+ acknowledgement, an explicit product policy that GIPO contains no 18+ content, a persistent role-play persona, and durable language and appearance preferences. It also adds a standard account settings area and a cancellable account-deletion workflow. The design preserves the existing GitHub Pages frontend and Supabase backend boundary: browser code never receives Grok keys, Telegram tokens, service keys, or password hashes.

The following work is intentionally outside this phase: an admin model-management panel, creation of bot cover images, user-generated background uploads, server-side moderation of bot and story text, a wizarding-school progression experience, and general email-notification delivery. They will be designed as later, separately testable phases.

## 2. Product Rules

| Rule | Product behavior |
|---|---|
| Account entry | The unauthenticated page presents distinct **Sign in** and **Create account** choices. Password sign-in uses email and password; a public handle is an identity surface, not a login credential. |
| Registration | Display name, unique public handle, email, password, and password confirmation are required. The handle is 3–24 lower-case Latin letters, digits, or underscores and is compared case-insensitively. |
| Password generation | The registration and password-change forms offer a local strong-password generator, visibility toggle, copy button, and strength feedback. Generated values live only in in-memory form state and are only sent to Supabase Auth when the user submits. |
| Email confirmation | New users must verify their email before onboarding or content creation. A clear resend-confirmation state is shown when confirmation has not happened. |
| 16+ policy | The first-run flow requires acknowledgement of **“I am at least 16 years old”** and **“GIPO does not allow 18+ content.”** Date of birth is neither requested nor stored. |
| Persona | A user can save an optional persona name, pronouns, and a short role-play description. The user separately controls whether it is offered as the default starting context for future stories. |
| Appearance | The user chooses Persian or English, system/light/dark appearance, and one of `none`, `cats-dark`, or `doodles-gradient` backgrounds. The provided image files become the latter two choices. |
| Account deletion | The user must confirm the exact deletion phrase. The account immediately enters a restricted, deletion-pending state and all sessions are ended. A signed-in return path permits cancellation for 14 days. Final deletion removes personal records and encrypted integration settings. |

## 3. Account and Onboarding Experience

The unauthenticated landing page has two equal, clear actions: **Sign in** and **Create account**. Sign in collects email and password, provides password recovery, and directs unconfirmed users to a resend-confirmation view. Account registration includes inline validation for each field, shows whether the requested handle is available, and prevents submission until password confirmation and the password-strength requirements are satisfied.

After email confirmation, GIPO reads the user profile. If onboarding is incomplete, it opens a five-step onboarding sequence. The user cannot create a bot or use chat until the sequence is complete, but may sign out at any time. Each completed step is persisted so a browser refresh does not discard a completed acknowledgement or preference.

| Step | Content | Completion condition |
|---|---|---|
| 1. Welcome and safety | 16+ acknowledgement and no-18+-content policy | Both explicit checkboxes are selected. |
| 2. Identity | Display-name review and public-handle preview | Required registration values remain valid. |
| 3. Persona | Optional persona name, pronouns, description, and default-context choice | Optional values satisfy length limits. |
| 4. Language and appearance | Persian/English, system/light/dark, and supplied background selection with immediate preview | One valid value is set per preference. |
| 5. Finish | Short summary and save | The profile update succeeds and `onboarding_completed_at` is set. |

Authenticated account settings use a tabbed page with: **Profile & persona**, **Security & email**, **Language & appearance**, **Privacy & available notifications**, **Connections**, and **Danger zone**. The existing encrypted Grok and Telegram configuration remains under Connections. Generic outbound email-notification preferences are not displayed until an actual delivery channel exists; only existing story and Telegram follow-up preferences are surfaced.

## 4. Data Contract and Authorization

The existing `public.profiles` table remains the single durable product-profile record. A forward-only Supabase migration adds nullable or defaulted columns without changing existing field meanings.

| Column | Type and constraint | Meaning |
|---|---|---|
| `public_handle` | `text`, case-insensitive unique index, `^[a-z0-9_]{3,24}$` | Stable public identifier. |
| `onboarding_completed_at` | `timestamptz` nullable | Completion marker for the first-run experience. |
| `age_gate_acknowledged_at` | `timestamptz` nullable | Records the 16+ and no-18+ acknowledgement without collecting date of birth. |
| `locale` | `text` default `fa`, check `fa` or `en` | Interface language and layout direction. |
| `theme_preference` | `text` default `system`, check `system`, `light`, or `dark` | Appearance mode. |
| `background_preference` | `text` default `none`, check `none`, `cats-dark`, `doodles-gradient` | Chosen supplied background. |
| `persona_name` | `text` nullable, maximum 80 characters | Optional role-play persona name. |
| `persona_pronouns` | `text` nullable, maximum 80 characters | Optional pronouns. |
| `persona_description` | `text` nullable, maximum 600 characters | Optional, user-authored role-play context. |
| `persona_enabled_by_default` | `boolean` default `false` | Whether a future story may suggest the persona as a starting context. |
| `profile_visibility` | `text` default `private`, check `private` or `public` | Reserved privacy preference; no public profile endpoint ships in this phase. |
| `account_status` | `text` default `active`, check `active` or `deletion_pending` | Gates content operations during cancellation window. |
| `deletion_requested_at` | `timestamptz` nullable | Start of deletion request. |
| `deletion_effective_at` | `timestamptz` nullable | Timestamp after which deletion is final. |

RLS continues to allow a user to read and update only their own profile. The migration updates content-table policies so creating, editing, starting, or sending a story requires a profile with `account_status = 'active'`. A deletion-pending user may read their own profile only far enough to see the recovery state and cancel deletion; the account cannot access stories, bots, messages, integrations, or follow-up preferences.

Password authentication is delegated to Supabase Auth. The browser calls `signUp`, `signInWithPassword`, password-recovery, and user-credential update methods through the Supabase client. An authenticated server-side function handles account-deletion requests, session revocation, status changes, cancellation, and final removal because these actions require service-level controls. That function returns a consistent public error shape and never returns secrets or internal implementation details.

## 5. Account Deletion Lifecycle

1. A signed-in active user opens **Danger zone**, sees a plain-language effect summary, and types the exact Persian confirmation phrase.
2. The deletion function sets `account_status` to `deletion_pending`, writes a fourteen-day `deletion_effective_at`, deletes encrypted integration settings, revokes active sessions, and records an auditable request timestamp.
3. On a later sign-in, the client detects the pending status, hides the normal application, and displays the deletion date with a single cancellation action.
4. Cancelling before the deadline restores `account_status = 'active'` and clears the deletion timestamps. The user must reconnect Grok and Telegram because their encrypted credentials were removed when deletion began.
5. A dedicated authenticated cleanup worker finalizes deletion only after the deadline. It removes user-owned profile data and dependent content through foreign-key cascades, then deletes the corresponding Supabase Auth user. The worker is idempotent and records structured failures for retry.

## 6. Visual and Localization Behavior

The existing editorial archive style remains the base design. Persian is the initial locale and uses `dir="rtl"`; English uses `dir="ltr"` and English labels. The selected language is applied before rendering the authenticated workspace to avoid mixed-direction layouts. The selected theme determines design tokens, while `system` follows the browser setting. Background selection is purely decorative, keeps text contrast valid, and respects reduced-motion settings.

The two user-supplied images are external static assets, not database blobs. They will be copied into the project asset workspace and referenced by their durable static-asset URLs. The app uses them as low-contrast, fixed background layers only when the relevant preference is active. The fallback is no decorative background.

## 7. Error Handling and Safety Boundaries

Registration errors distinguish invalid fields, unavailable handle, duplicate email, unconfirmed email, weak password, and network failure without revealing whether unrelated accounts exist. Handle availability checks are debounced and are never treated as final authorization; the unique database index is authoritative. Password-generator and clipboard failures remain local to the form and do not block manually entered passwords.

The static policy text and age acknowledgement are enforced before onboarding completes. This phase does not claim that client validation alone makes generated or user-provided story content safe. The later bot-creation phase must add server-side content validation and apply the same rules to web, Telegram, and AI output paths.

## 8. Testing and Acceptance Criteria

The implementation must add automated tests for input schemas, handle normalisation and collision behavior, age-gate enforcement, onboarding eligibility, locale and theme preference parsing, deletion state transitions, cancellation before deadline, authorization denial while deletion is pending, and the public error contract of account functions. Browser validation covers sign-up, email-confirmation state, sign-in, password generation/copy, login redirect, onboarding persistence, RTL/LTR rendering, light/dark/system modes, both selected backgrounds, settings edits, deletion request, and cancellation.

Acceptance requires that a confirmed user can register, sign in with email and password, complete onboarding, edit settings, sign out, sign back in on another device and retrieve the same preferences. A user whose deletion is pending must be unable to create or continue a story; cancellation before the deadline restores permitted access. No password, Grok key, Telegram token, service key, or password hash can be returned to browser code or committed to source control.
