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
    defineSkin,
    skinProblems,
    skins: SKINS,
  } = globalThis.GITALIKE_PLUGINS;

  // Every nav rule ranks by its skin's `repoOrder`, filled in here so the rule
  // and the order cannot drift apart.
  for (const skin of Object.values(SKINS)) {
    for (const rule of skin.navRules) rule.order = skin.repoOrder;
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
    defineSkin,
    skinProblems,
    SKINS,
    PHRASES: bySkin('phrases'),
    NAV: bySkin('nav'),
    LABELS: bySkin('labels'),
    CHROME: bySkin('chrome'),
    UNMAPPED: bySkin('unmapped'),
    TOPBAR_HIDE: bySkin('topbarHide'),
    SHORTCUTS: bySkin('shortcuts'),
    SHORTCUT_TARGETS: bySkin('shortcutTargets'),
    NAV_HIDE: bySkin('hide'),
    NAV_KEEP: bySkin('keep'),
    NAV_GROUPS: bySkin('groups'),
    NAV_RULES: bySkin('navRules'),
    PROJECT_TABS: bySkin('projectTabs'),
    PROFILE_MENU: bySkin('profileMenu'),
  };
})();
