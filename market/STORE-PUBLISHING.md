# Publishing GitAlike to every extension store

Internal plan. The goal: one build per engine, submitted to every store that
matters, so Chromium and Firefox **and their forks** can install it the normal
way.

Two facts drive the whole plan:

1. There are only **two extension platforms** — Chromium and Firefox. Every
   other browser is a fork that draws from one of them, so there are only two
   artefacts to produce.
2. A fork does not usually have its own store. It installs from the platform's
   store (or sideloads). That means the store list is shorter than the browser
   list.

## The two artefacts

| Artefact | Built by | Consumed by |
| --- | --- | --- |
| `gitalike-chromium.zip` | `npm run package:chromium` (`dist/chromium`) | Chrome Web Store, Edge Add-ons, Opera Add-ons, and sideloads in every Chromium browser |
| `gitalike-firefox.zip` / signed `.xpi` | `npm run package:firefox` / `npm run sign:firefox` | addons.mozilla.org, and sideloads in Firefox and its forks |

## Store matrix

| Store | Engine | Account / credential | Tooling today | Priority |
| --- | --- | --- | --- | --- |
| **Chrome Web Store** | Chromium | CWS v2 API: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, `CWS_ITEM_ID` | ✅ `npm run publish:chromium` (v2 API; v1 dies 2026-10-15) | 1 |
| **addons.mozilla.org** | Firefox | `WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET` | ✅ `npm run sign:firefox` (`web-ext sign`, unlisted) | 1 |
| **Microsoft Edge Add-ons** | Chromium | Partner Center Publish API: `EDGE_CLIENT_ID`, `EDGE_API_KEY`, `EDGE_PRODUCT_ID` | ✅ `npm run publish:edge` (Update API v1.1) | 2 |
| **Opera Add-ons** | Chromium | Opera developer account | ❌ manual dashboard, no public submission API | 2 |
| **Firefox Android (AMO)** | Firefox | same AMO account | ✅ rides the AMO listing | 3 |
| **Samsung Internet** | Chromium | Galaxy Store; also installs CWS extensions | ➖ via CWS where supported | 3 |
| **Yandex Browser** | Chromium | installs from the Chrome Web Store | ➖ via CWS | 3 |
| **Safari / App Store** | WebKit | Apple Developer + Xcode | ❌ a port, not a build — out of scope for now | — |

**Forks with no store of their own** install the same two artefacts: Brave,
Vivaldi, Arc, Chromium (CWS/Edge or sideload); LibreWolf, Floorp, Zen, Waterfox
(AMO or sideload — see the version caveat below).

## Caveats to state honestly in copy

- **Firefox floor is 142.** `strict_min_version` is `142.0` (the first release
  whose desktop and Android both understand `data_collection_permissions`). A
  fork on an older base — e.g. an ESR older than 142, which includes some
  Waterfox/Mullvad builds — will refuse it. Say "Firefox 142+" and "forks that
  track it", not "all Firefox forks".
- **The Firefox build is unsigned** unless installed from AMO; sideloading via
  `about:debugging` is temporary. Store copy must not imply a permanent
  sideload.
- **Safari is a separate project.** `safari-web-extension-converter` + Xcode +
  App Store review; MV3 support differs. Do not list it as supported.
- **Mobile:** Firefox Android is covered by AMO. Chromium Android does **not**
  support extensions, so no mobile claim for Chromium.

## What each store needs (submission copy)

The copy already lives in `store/`:

- `store/listing-chrome.md` — name, short/long description, single-purpose,
  permission justifications, data-usage answers, reviewer test steps.
- `store/listing-firefox.md` — name, summary, description, category, tags,
  licence, privacy policy, `data_collection_permissions`, reviewer notes.

Edge and Opera reuse the Chrome copy almost verbatim (same Chromium artefact,
same privacy story). When scripting Edge, add `store/listing-edge.md` only if
the Edge form needs different fields; otherwise point at the Chrome file.

Store URLs to add once live (README, `docs/index.html`, both listings):

- Chrome: `https://chromewebstore.google.com/detail/<id>`
- Edge: `https://microsoftedge.microsoft.com/addons/detail/<id>`
- AMO: `https://addons.mozilla.org/firefox/addon/<slug>/`
- Opera: `https://addons.opera.com/extensions/details/<slug>/`

## Edge publishing (implemented)

`tools/publish-edge.mjs` (`npm run publish:edge`) uploads and publishes the
Chromium package with the Edge Add-ons **Update** REST API. Flow:

1. `POST /v1/products/{productId}/submissions/draft/package` (the ZIP).
2. Poll the `Location` operation until `Succeeded`.
3. `POST /v1/products/{productId}/submissions` to submit the draft for review.
4. Poll the publish operation.

Auth is the **v1.1** scheme — `Authorization: ApiKey <key>` + `X-ClientID` —
both taken from Partner Center → **Publish API**. The v1 Azure AD bearer token
is gone (support ended 2024-12-31), so no tenant/client-secret dance is needed.

Two things to remember:

- **The first submission is manual.** The API only updates an existing product;
  create the listing in Partner Center once, then the script takes over.
- **Reuse the Chrome bytes.** `release.yml` passes
  `--source dist/release/gitalike-chromium.zip`, so Edge and Chrome receive the
  identical package, and the step is gated on `EDGE_PUBLISH=true` with secrets
  `EDGE_CLIENT_ID`, `EDGE_API_KEY`, `EDGE_PRODUCT_ID`.

Opera has no public submission API, so it stays a manual dashboard upload of
the same Chromium ZIP.

## Order of operations

1. Publish the Chrome Web Store and AMO listings (highest reach; forks draw
   from these).
2. File the awesome-list entry with the live store URLs (currently pending —
   see `SUBMISSION-KIT.md`).
3. Create the Edge listing in Partner Center once; `npm run publish:edge` then
   handles every update.
4. Add Opera manually.
5. Update `README.md`, `docs/index.html` and both listings with the store links;
   drop the "in the works" wording.
6. Only then claim "available on every major extension store" in public copy.

## Checklist

- [ ] Chrome Web Store: submit, pass review, record the public URL.
- [ ] AMO: submit, pass review, record the public URL; confirm the `142.0` floor.
- [ ] Edge Add-ons: create the Partner Center product, submit the Chromium ZIP.
- [ ] Opera Add-ons: manual upload of the Chromium ZIP.
- [x] Edge API automation (`tools/publish-edge.mjs` + `EDGE_PUBLISH` gate) —
      still needs the Partner Center product and secrets to actually run.
- [ ] Replace "in the works" copy with live store links in README, the page and
      the listings.
- [ ] Re-check the forks caveat (Firefox 142 floor) in every listing.
