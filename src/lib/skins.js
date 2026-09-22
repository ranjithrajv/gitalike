/**
 * GitAlike — the derived skin tables.
 *
 * The skins themselves are declared one file per plugin under
 * `src/plugins/skins/`, registering with `defineSkin` (`plugins/core.js`). This
 * file composes them into the flat tables the rest of the code and the tests
 * read — `PHRASES`, `NAV`, `NAV_RULES`, `PROFILE_MENU`, … — and publishes
 * `globalThis.GITALIKE_SKINS`.
 *
 * It is loaded after every plugin file and before `sites.js`/`ux.js` (see
 * `background.js` `CONTENT_JS`, `build.mjs` and `popup.html`). Every table is
 * keyed by the theme being *applied*:
 *
 *   'gitlab'  a GitHub-flavoured site shown with the GitLab UI
 *   'github'  a GitLab-flavoured site shown with the GitHub UI
 *   'bitbucket'  any site shown with the Bitbucket UI
 *
 * Only the tables a skin *declares* appear in a derived table, so a skin with no
 * `groups` is absent from `NAV_GROUPS` rather than present and empty — `navKeep`
 * reads an absent `keep` as "no whitelist", which an empty one would turn into
 * "keep nothing". `defineSkin` fills the optional capabilities on the skin
 * object itself.
 */
(() => {
  'use strict';

  if (!globalThis.GITALIKE_PLUGINS) {
    throw new Error(
      'GitAlike: plugins/core.js must be loaded before lib/skins.js',
    );
  }
  const {
    API_VERSION,
    SKIN_REQUIRED,
    SKIN_CAPABILITIES,
    defineSkin,
    skinProblems,
    assertCompatible,
    skins: SKINS,
    sources: ALL_SOURCES,
  } = globalThis.GITALIKE_PLUGINS;

  // Every nav rule ranks by its skin's `repoOrder`, filled in here so the rule
  // and the order cannot drift apart.
  for (const skin of Object.values(SKINS)) {
    for (const rule of skin.navRules) rule.order = skin.repoOrder;
  }

  // Validate the rules a skin can only state, never check, here: a rule that
  // names no registered source, or has no container, silently never fires on a
  // page. Failing at load names the skin, so a contributor sees it instead of a
  // nav that quietly does not reorder.
  for (const [name, skin] of Object.entries(SKINS)) {
    for (const [index, rule] of skin.navRules.entries()) {
      const where = `skin '${name}' navRules[${index}]`;
      if (!Object.hasOwn(ALL_SOURCES, rule?.source)) {
        throw new Error(
          `GitAlike: ${where} names source '${rule?.source}', which is not registered`,
        );
      }
      if (
        typeof rule.container !== 'string' &&
        typeof rule.scope !== 'string'
      ) {
        throw new Error(`GitAlike: ${where} needs a container or a scope`);
      }
      if (typeof rule.item !== 'string' || !rule.item) {
        throw new Error(`GitAlike: ${where} needs an item selector`);
      }
      if (!Array.isArray(rule.order) || !rule.order.length) {
        throw new Error(`GitAlike: ${where} needs a non-empty order`);
      }
    }
    if (!skin.repoOrder.every((label) => typeof label === 'string' && label)) {
      throw new Error(`GitAlike: skin '${name}' repoOrder has an empty label`);
    }
    if (skin.projectTabs !== null && typeof skin.projectTabs !== 'function') {
      throw new Error(
        `GitAlike: skin '${name}' projectTabs must be a function or null`,
      );
    }
  }

  // The tables a skin declares are published; the optional ones it leaves out
  // are absent from the derived table, exactly as when each was hand-written.
  const declared = (skin, part) => skin.declared.has(part);

  const bySkin = (part) =>
    Object.fromEntries(
      Object.entries(SKINS)
        .filter(([, skin]) => declared(skin, part))
        .map(([name, skin]) => [name, skin[part]]),
    );

  globalThis.GITALIKE_SKINS = {
    API_VERSION,
    SKIN_REQUIRED,
    SKIN_CAPABILITIES,
    defineSkin,
    skinProblems,
    assertCompatible,
    SKINS,
    PHRASES: bySkin('phrases'),
    NAV: bySkin('nav'),
    LABELS: bySkin('labels'),
    CHROME: bySkin('chrome'),
    UNMAPPED: bySkin('unmapped'),
    UNAVAILABLE: bySkin('unavailable'),
    TOPBAR_HIDE: bySkin('topbarHide'),
    SHORTCUTS: bySkin('shortcuts'),
    SHORTCUT_TARGETS: bySkin('shortcutTargets'),
    NAV_HIDE: bySkin('hide'),
    NAV_KEEP: bySkin('keep'),
    NAV_GROUPS: bySkin('groups'),
    NAV_RULES: bySkin('navRules'),
    PROJECT_TABS: bySkin('projectTabs'),
    PROFILE_MENU: bySkin('profileMenu'),
    ACTIVITY: bySkin('activity'),
  };
})();
