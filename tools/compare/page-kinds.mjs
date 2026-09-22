#!/usr/bin/env node
/**
 * The page kinds the comparison framework scores, derived from the plugin
 * registry rather than hardcoded.
 *
 * `PAGE_KINDS` (`plugins/core.js`) is the list of kinds a source may declare;
 * each source's `pages` map says which it actually has. A kind is *comparable*
 * for a source when the source declares it (not `null`) **and** the framework
 * has a recipe for it — a capture to drive, selectors to read, a rubric to
 * score. So a source that has no sign-in form is simply not scored there, and
 * nothing assumes every forge has a profile.
 *
 *   import { PAGE_KINDS, comparableKinds, isComparable } from './page-kinds.mjs';
 *
 * `comparableKinds()` returns the kinds every source declares, in PAGE_KINDS
 * order, so the framework's tables and the docs share one list. Anything
 * outside it (dashboard, settings, signIn, signOut today) is declared by the
 * plugins but not yet scored: the framework reports them as *not compared*
 * rather than silently omitting them.
 */
import '../plugins.mjs';

const PLUGINS = globalThis.GITALIKE_PLUGINS;

/** Every page kind a source may declare, in the order the API lists them. */
export const PAGE_KINDS = Object.keys(PLUGINS.PAGE_KINDS);

/**
 * A human label for a kind, for a table header or a filename fragment:
 * `signIn` -> `Sign-in`, `project` -> `Project`.
 */
export const kindLabel = (kind) =>
  kind
    .replace(/^[a-z]/, (c) => c.toUpperCase())
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/-([A-Z])/g, (_, c) => `-${c.toLowerCase()}`);

/** Does this source declare this kind at all (a page, or knowingly none)? */
export const declares = (source, kind) =>
  Object.hasOwn(PLUGINS.sources[source]?.pages ?? {}, kind);

/** Does this source actually have this kind? (`null` means it has none.) */
export const has = (source, kind) =>
  Boolean(PLUGINS.sources[source]?.pages?.[kind]);

/**
 * The kinds every source declares, in PAGE_KINDS order. A kind only some
 * sources declare is excluded, so a comparison table is never mostly blanks.
 */
export function declaredKinds() {
  const sources = Object.keys(PLUGINS.sources);
  return PAGE_KINDS.filter((kind) =>
    sources.every((source) => declares(source, kind)),
  );
}

/**
 * The kinds to score, given the recipes the framework actually has. `recipes`
 * is a set/array of kinds the caller can drive (a capture + selectors + a
 * rubric); a declared kind with no recipe is reported as not-compared.
 */
export function comparableKinds(recipes) {
  const available = new Set(recipes ?? []);
  return declaredKinds().filter((kind) => available.has(kind));
}

/** The declared kinds the framework has no recipe for, so a caller can say so. */
export function missingRecipes(recipes) {
  const available = new Set(recipes ?? []);
  return declaredKinds().filter((kind) => !available.has(kind));
}

/** A source × kind grid: every source, each declared kind marked has/none. */
export function coverage() {
  return Object.entries(PLUGINS.sources).map(([source, plugin]) => ({
    source,
    pages: Object.fromEntries(
      PAGE_KINDS.map((kind) => [kind, plugin.pages?.[kind] ?? null]),
    ),
  }));
}
