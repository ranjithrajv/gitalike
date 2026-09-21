/**
 * GitAlike — UX content script: entry point.
 *
 * The pass modules and the core are listed before this file in CONTENT_JS, so
 * by the time it runs every pass has registered. It only boots the core; the
 * design notes and the shared runtime live in ux-core.js, and each pass group
 * in its own file (ux-copy.js, ux-nav.js, ux-project.js, ux-profile.js).
 */
globalThis.GITALIKE_UX_RUNTIME?.start?.();
