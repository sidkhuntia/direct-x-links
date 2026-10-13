# Direct X Links

A Chrome extension that makes links on x.com and twitter.com open their real destination directly, instead of going through a t.co redirect.

## What it does

On x.com and twitter.com, X replaces every external link with a t.co short link. This extension swaps those links on the page for the destination URL X already sent to the page, so clicking them goes straight to the site.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `extension` folder.

Requires Chrome 111 or later.

## How it works

- The content script runs in the page's own JavaScript context and watches X's JSON API responses for `t.co` to `expanded_url` pairs.
- It rewrites the `href` of matching anchors in the DOM. If X has no mapping for a link, the anchor's `title` is used as a fallback when it holds a valid http(s) URL.
- It keeps up with new content as the page changes (X renders its timeline dynamically).
- It makes no network requests of its own.

## Permissions and privacy

- The extension requests no permissions: no `permissions` and no `host_permissions` in the manifest.
- It has no background service worker.
- It stores nothing. The t.co mappings live only in memory on the open page and are discarded when the page is closed or reloaded.
- It sends nothing anywhere.
- The content script runs only on `x.com`, `*.x.com`, `twitter.com` and `*.twitter.com`.

## Limitations

- A link whose destination X did not send to the page (for example, some cards) stays as a t.co link.
- Links opened from outside X, such as a t.co link pasted into another app, still go through t.co. The extension only changes links on X pages.
- The extension depends on X's current API responses and markup. If X changes either, it may stop working until updated.

## Files

- `manifest.json`: extension manifest (Manifest V3).
- `content.js`: the content script that collects the t.co mappings and rewrites links.
- `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`: extension icons.
