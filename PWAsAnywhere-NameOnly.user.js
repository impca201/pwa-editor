// ==UserScript==
// @name        PWA Manifest Editor (Name Only)
// @match       *://*/*
// @version     1.0.0
// @license     ISC
// @description Edit PWA Manifest name and short name only
// @run-at      document-idle
// @grant       GM_registerMenuCommand
// ==/UserScript==

GM_registerMenuCommand('📃 Set Custom Manifest', setCustomManifest);
GM_registerMenuCommand('🚮 Remove Custom Manifest', removeCustomManifest);

function toHexColor(str) {
  if (!str) return null;
  str = str.trim();
  if (/^#[0-9a-f]{6}$/i.test(str)) return str.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(str)) return '#' + str[1]+str[1]+str[2]+str[2]+str[3]+str[3];
  var m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) {
    if (parseFloat(m[4]) === 0) return null;
    return '#' + [m[1], m[2], m[3]].map(function(n) {
      return ('0' + parseInt(n, 10).toString(16)).slice(-2);
    }).join('');
  }
  return null;
}

function detectFromPage() {
  var descElem = document.querySelector('meta[name="description"]');
  var iconElem = document.querySelector('link[rel~="apple-touch-icon"]') || document.querySelector('link[rel~="icon"]');
  var themeElem = document.querySelector('meta[name="theme-color"]');
  var title = document.title || location.href;
  var bgHex = toHexColor(getComputedStyle(document.body).backgroundColor);

  return {
    name:             title,
    short_name:       title.slice(0, 15),
    display:          'standalone',
    theme_color:      toHexColor((themeElem && themeElem.content) || '') || '#000000',
    background_color: bgHex || '#ffffff',
    icon_url:         (iconElem && iconElem.href) || (location.origin + '/favicon.ico'),
    start_url:        location.href,
    scope:            location.href,
    description:      (descElem && descElem.content) || '',
  };
}

function manifestJsonToDefaults(m) {
  var page = detectFromPage();
  return {
    name:             m.name             || page.name,
    short_name:       m.short_name       || page.short_name,
    display:          m.display          || 'standalone',
    theme_color:      toHexColor(m.theme_color)      || page.theme_color,
    background_color: toHexColor(m.background_color) || page.background_color,
    icon_url:         (m.icons && m.icons[0] && m.icons[0].src) || page.icon_url,
    start_url:        m.start_url        || page.start_url,
    scope:            m.scope            || page.scope,
    description:      m.description      || page.description,
  };
}

function getManifestDefaults(callback) {
  var link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    callback(detectFromPage());
    return;
  }
  var href = link.getAttribute('href');
  if (href.startsWith('data:')) {
    try {
      var json = decodeURIComponent(href.split(',')[1] || '');
      callback(manifestJsonToDefaults(JSON.parse(json)));
      return;
    } catch (e) {}
  }
  var called = false;
  function done(defaults) {
    if (called) return;
    called = true;
    callback(defaults);
  }
  var controller = new AbortController();
  var timer = setTimeout(function() {
    controller.abort();
    done(detectFromPage());
  }, 3000);
  fetch(href, { signal: controller.signal })
    .then(function(r) { return r.json(); })
    .then(function(m) { clearTimeout(timer); done(manifestJsonToDefaults(m)); })
    .catch(function() { clearTimeout(timer); done(detectFromPage()); });
}

function makeManifestElem(href) {
  var el = document.createElement('link');
  el.rel = 'manifest';
  el.href = href;
  return el;
}

function injectManifest(opts) {
  var iconUrl = opts.icon_url || (location.origin + '/favicon.ico');
  var manifest = {
    name:             opts.name || document.title || location.href,
    short_name:       opts.short_name || undefined,
    description:      opts.description || undefined,
    start_url:        opts.start_url || location.href,
    scope:            opts.scope || location.href,
    display:          opts.display || 'standalone',
    theme_color:      opts.theme_color || undefined,
    background_color: opts.background_color || undefined,
    lang:             document.documentElement.lang || undefined,
    icons: [{ src: iconUrl, sizes: 'any', purpose: 'any' }],
  };
  document.head.appendChild(makeManifestElem(
    'data:application/manifest+json;utf8,' + encodeURIComponent(JSON.stringify(manifest))
  ));
}

function removeCurrentManifest() {
  var el = document.querySelector('link[rel="manifest"]');
  if (el) el.parentElement.removeChild(el);
}

function setCustomManifest() {
  getManifestDefaults(function(d) {
    var name = prompt('App name:', d.name);
    if (name === null) return;

    var shortName = prompt('Short name (≤15 chars):', d.short_name);
    if (shortName === null) return;

    removeCurrentManifest();
    injectManifest({
      name:             name,
      short_name:       shortName || undefined,
      display:          d.display,
      theme_color:      d.theme_color || undefined,
      background_color: d.background_color || undefined,
      icon_url:         d.icon_url,
      start_url:        d.start_url,
      scope:            d.scope,
      description:      d.description || undefined,
    });
  });
}

function removeCustomManifest() {
  removeCurrentManifest();
}

if (!document.querySelector('link[rel="manifest"]')) {
  injectManifest(detectFromPage());
}
