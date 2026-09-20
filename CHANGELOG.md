# Changelog

All notable changes to Git Same are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-20

First public release. Git Same re-skins GitHub as GitLab and GitLab as GitHub —
appearance only: it never rewrites the page, renames buttons, or changes what the
site does.

### Added

- Two skins, driven by a class on `<html>`: `gs-theme-gitlab` on
  GitHub-flavoured sites and `gs-theme-github` on GitLab-flavoured ones, plus a
  dark palette for either.
- Bundled support for `github.com`, `gitlab.com` and `code.swecha.org`, and a
  popup flow for classifying any other instance — GitHub Enterprise Server and
  self-hosted GitLab included — either on the page in front of you or by typing
  its address.
- Address parsing that accepts bare hosts and full URLs and refuses anything
  that is not an http(s) web address, including `javascript:` and other
  non-http schemes.
- Independent on/off switches per product, with the current site's row
  highlighted and every host each switch covers listed.
- `Alt`+`Shift`+`G` keyboard command to toggle the site you are on, and a
  `GL`/`GH` toolbar badge while a skin is active.
- No network access of any kind: both stylesheets are bundled and both logos are
  inline data URIs.

### Changed

- GitHub's signed-in header (`header.GlobalNav`) is now matched, so it gets
  GitLab's colour and hairline border instead of ending up greyer than the page.
- Dark-mode detection asks the OS directly when GitHub is set to "sync with
  system", instead of reading back its own `color-scheme`.
- GitLab's explicit light mode (`gl-light`) is now honoured, so a light GitLab on
  a dark desktop is no longer skinned dark.
- Logo art was redrawn to recolour the site's own mark in the other brand's
  palette (the shape is never swapped between products), replacing the earlier
  monochrome stand-ins.

### Fixed

- GitLab's filled "Sign in" button no longer renders white-on-white on the
  skinned top bar.
- The `<img>` logo fallback no longer repaints project avatars named "GitLab".
- The popup no longer throws if its shared host list fails to load.
- GitLab's search field no longer keeps a light background under light
  placeholder text.
- GitHub header text no longer stays near-white after the bar is flipped light.

### Notes

- **Appearance only.** Labels still say "Pull request" on GitHub and "Merge
  request" on GitLab, and icons keep their original meaning.
- The Firefox build declares `data_collection_permissions: none` and requires
  Firefox 142. The Chromium build targets Manifest V3.
- Verified against the live sites in Chromium, including a signed-in session;
  see the README's Verification section for what was and was not exercised.
