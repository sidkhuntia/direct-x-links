// Direct X Links — rewrites t.co hrefs to their real destination.
//
// Runs in the page's MAIN world so it can see the same API responses X's own
// app uses. Those responses carry {url: "https://t.co/…", expanded_url: "…"}
// pairs; we collect them and swap the hrefs in the DOM. No network requests
// of our own, no permissions.
(function (root) {
  'use strict';

  var TCO = /^https?:\/\/t\.co\/[A-Za-z0-9]+\/?$/i;

  function safeHttpUrl(value) {
    if (typeof value !== 'string') return null;
    try {
      var u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
    } catch (e) {
      return null;
    }
  }

  // Walk any JSON-like value and record every t.co -> expanded_url pair.
  function collect(node, map, seen, depth) {
    if (!node || typeof node !== 'object') return;
    seen = seen || new Set();
    depth = depth || 0;
    if (depth > 60 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) collect(node[i], map, seen, depth + 1);
      return;
    }
    if (typeof node.url === 'string' && TCO.test(node.url)) {
      var dest = safeHttpUrl(node.expanded_url);
      if (dest && !TCO.test(dest)) map.set(normalize(node.url), dest);
    }
    for (var k in node) collect(node[k], map, seen, depth + 1);
  }

  function normalize(tco) {
    return tco.replace(/^http:/i, 'https:').replace(/\/$/, '');
  }

  // Destination for an anchor, or null if unknown. The anchor's own title is
  // only a fallback: X sets it to the expanded URL on tweet links.
  function destinationFor(href, title, map) {
    if (!TCO.test(href)) return null;
    var hit = map.get(normalize(href));
    if (hit) return hit;
    var t = safeHttpUrl(title);
    return t && !TCO.test(t) ? t : null;
  }

  var api = { collect: collect, destinationFor: destinationFor, safeHttpUrl: safeHttpUrl };
  if (typeof window === 'undefined' && typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  if (!root.document) return;

  var map = new Map();
  var SELECTOR = 'a[href*="t.co/"], a[data-dxl-tco]';

  // The original t.co href is kept in data-dxl-tco so a destination that
  // arrives later (or a title-based guess) can still be corrected. If React
  // reuses the node for a new link, its fresh t.co href wins.
  function rewrite(a) {
    var href = a.getAttribute('href');
    if (!href) return;
    if (!TCO.test(href)) href = a.getAttribute('data-dxl-tco') || href;
    var dest = destinationFor(href, a.getAttribute('title'), map);
    if (!dest) return;
    if (TCO.test(href)) a.setAttribute('data-dxl-tco', href);
    if (a.getAttribute('href') !== dest) a.setAttribute('href', dest);
  }

  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.matches(SELECTOR)) rewrite(node);
    var list = node.querySelectorAll(SELECTOR);
    for (var i = 0; i < list.length; i++) rewrite(list[i]);
  }

  var queued = false;
  var pending = [];
  function schedule(node) {
    if (node) pending.push(node);
    if (queued) return;
    queued = true;
    root.requestAnimationFrame(function () {
      queued = false;
      var nodes = pending;
      pending = [];
      for (var i = 0; i < nodes.length; i++) scan(nodes[i]);
    });
  }

  function ingest(data) {
    var before = map.size;
    try { collect(data, map); } catch (e) { /* never break the page */ }
    if (map.size !== before) schedule(root.document.documentElement);
  }

  // --- DOM: initial pass + keep up with React re-renders / virtualised list.
  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === 'attributes') schedule(r.target);
      else for (var j = 0; j < r.addedNodes.length; j++) schedule(r.addedNodes[j]);
    }
  }).observe(root.document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'title']
  });

  // --- Data: tap X's own JSON responses.
  function isJson(contentType) {
    return typeof contentType === 'string' && contentType.indexOf('json') !== -1;
  }

  var origFetch = root.fetch;
  if (typeof origFetch === 'function') {
    root.fetch = function () {
      var p = origFetch.apply(this, arguments);
      p.then(function (res) {
        if (!isJson(res.headers.get('content-type'))) return;
        res.clone().json().then(ingest, function () {});
      }).catch(function () {});
      return p;
    };
  }

  var origSend = root.XMLHttpRequest && root.XMLHttpRequest.prototype.send;
  if (origSend) {
    root.XMLHttpRequest.prototype.send = function () {
      this.addEventListener('load', function () {
        try {
          if (!isJson(this.getResponseHeader('content-type'))) return;
          if (this.responseType === 'json') ingest(this.response);
          else if (this.responseType === '' || this.responseType === 'text') ingest(JSON.parse(this.responseText));
        } catch (e) { /* ignore non-JSON */ }
      });
      return origSend.apply(this, arguments);
    };
  }

  // --- Data: state embedded in the server-rendered page.
  function seedFromPage() {
    ingest(root.__INITIAL_STATE__);
    scan(root.document.documentElement);
  }
  root.document.addEventListener('DOMContentLoaded', seedFromPage);
  root.addEventListener('load', seedFromPage);
})(typeof window !== 'undefined' ? window : this);
