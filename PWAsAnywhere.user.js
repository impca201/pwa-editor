// ==UserScript==
// @name        PWAs Anywhere
// @namespace   https://www.octt.eu.org/
// @match       *://*/*
// @version     2.0.0
// @author      OctoSpacc
// @license     ISC
// @description Allow installing any webpage as a progressive web app
// @run-at      document-idle
// @grant       GM_registerMenuCommand
// @downloadURL https://update.greasyfork.org/scripts/490784/PWAs%20Anywhere.user.js
// @updateURL https://update.greasyfork.org/scripts/490784/PWAs%20Anywhere.meta.js
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
  fetch(href)
    .then(function(r) { return r.json(); })
    .then(function(m) { callback(manifestJsonToDefaults(m)); })
    .catch(function() { callback(detectFromPage()); });
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showManifestOptionsDialog(defaults, callback) {
  var existing = document.getElementById('pwa-anywhere-dialog');
  if (existing) existing.remove();

  var dialog = document.createElement('dialog');
  dialog.id = 'pwa-anywhere-dialog';
  dialog.style.cssText = 'padding:0;border:none;border-radius:10px;box-shadow:0 6px 32px rgba(0,0,0,.4);background:#fff;color:#111;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;max-width:480px;width:min(90vw,480px);overflow:auto;';

  var fields = [
    {
      id: 'pwa-name', label: 'Name', type: 'text', value: defaults.name,
      hint: 'Full app name shown in launcher &amp; install prompt, e.g. "My Dashboard"',
    },
    {
      id: 'pwa-short-name', label: 'Short name', type: 'text', value: defaults.short_name,
      hint: 'Truncated label for tight spaces like home screen icons (≤ 15 chars), e.g. "Dashboard"',
    },
    {
      id: 'pwa-display', label: 'Display mode', type: 'select',
      options: [
        { value: 'standalone', label: 'standalone — own window, no browser UI (recommended)' },
        { value: 'fullscreen', label: 'fullscreen — hides all OS/browser chrome' },
        { value: 'minimal-ui', label: 'minimal-ui — small back/reload buttons only' },
        { value: 'browser',    label: 'browser — opens in a normal browser tab' },
      ],
      value: defaults.display,
      hint: 'Controls how the app window looks when launched from the home screen',
    },
    {
      id: 'pwa-theme-color', label: 'Theme color', type: 'color', value: defaults.theme_color,
      hint: 'Browser title-bar / mobile status-bar accent colour, e.g. #1a73e8',
    },
    {
      id: 'pwa-bg-color', label: 'Background color', type: 'color', value: defaults.background_color,
      hint: 'Splash screen background shown while the app is loading, e.g. #ffffff',
    },
    {
      id: 'pwa-icon', label: 'Icon URL', type: 'text', value: defaults.icon_url,
      hint: 'Direct URL to the app icon; PNG ≥ 192 × 192 px recommended. Leave blank to auto-detect.',
    },
    {
      id: 'pwa-start-url', label: 'Start URL', type: 'text', value: defaults.start_url,
      hint: 'URL opened when launching the installed PWA, e.g. https://example.com/app',
    },
    {
      id: 'pwa-scope', label: 'Scope', type: 'text', value: defaults.scope,
      hint: 'URL prefix treated as "in-app"; links outside this scope open in the browser, e.g. https://example.com/app/',
    },
  ];

  var fieldsHtml = fields.map(function(f) {
    var inputHtml;
    if (f.type === 'select') {
      inputHtml = '<select id="' + f.id + '" style="width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:5px;font-size:13px;background:#fff;color:#111;box-sizing:border-box;">';
      f.options.forEach(function(o) {
        inputHtml += '<option value="' + o.value + '"' + (o.value === f.value ? ' selected' : '') + '>' + o.label + '</option>';
      });
      inputHtml += '</select>';
    } else if (f.type === 'color') {
      inputHtml = '<div style="display:flex;align-items:center;gap:10px;">'
        + '<input type="color" id="' + f.id + '" value="' + escapeAttr(f.value) + '" style="width:48px;height:34px;padding:2px 3px;border:1px solid #ccc;border-radius:5px;cursor:pointer;background:#fff;">'
        + '<span id="' + f.id + '-hex" style="font-size:12px;color:#555;font-family:monospace;">' + escapeAttr(f.value) + '</span>'
        + '</div>';
    } else {
      inputHtml = '<input type="text" id="' + f.id + '" value="' + escapeAttr(f.value) + '" style="width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:5px;font-size:13px;color:#111;background:#fff;box-sizing:border-box;">';
    }
    return '<div style="display:flex;flex-direction:column;gap:4px;">'
      + '<label for="' + f.id + '" style="font-weight:600;font-size:13px;color:#333;">' + f.label + '</label>'
      + inputHtml
      + '<small style="color:#888;font-size:11px;">' + f.hint + '</small>'
      + '</div>';
  }).join('');

  dialog.innerHTML = ''
    + '<div style="padding:20px 22px 18px;background:#f8f9fa;border-bottom:1px solid #e0e0e0;border-radius:10px 10px 0 0;">'
    +   '<div style="font-weight:700;font-size:16px;color:#111;">📱 PWA Manifest Options</div>'
    +   '<div style="font-size:12px;color:#888;margin-top:2px;">' + location.hostname + '</div>'
    + '</div>'
    + '<form id="pwa-form" style="display:flex;flex-direction:column;gap:12px;padding:18px 22px;">'
    +   fieldsHtml
    +   '<div style="display:flex;justify-content:flex-end;gap:8px;padding-top:6px;border-top:1px solid #eee;margin-top:4px;">'
    +     '<button type="button" id="pwa-cancel" style="padding:8px 18px;border:1px solid #ccc;border-radius:6px;background:#f5f5f5;color:#444;font-size:13px;cursor:pointer;">Cancel</button>'
    +     '<button type="submit" style="padding:8px 18px;border:none;border-radius:6px;background:#1a73e8;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Apply</button>'
    +   '</div>'
    + '</form>';

  document.body.appendChild(dialog);

  ['pwa-theme-color', 'pwa-bg-color'].forEach(function(id) {
    var input = dialog.querySelector('#' + id);
    var hexLabel = dialog.querySelector('#' + id + '-hex');
    if (input && hexLabel) {
      input.addEventListener('input', function() { hexLabel.textContent = input.value; });
    }
  });

  dialog.querySelector('#pwa-cancel').addEventListener('click', function() {
    dialog.remove();
  });

  dialog.querySelector('#pwa-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var opts = {
      name:             dialog.querySelector('#pwa-name').value,
      short_name:       dialog.querySelector('#pwa-short-name').value || undefined,
      display:          dialog.querySelector('#pwa-display').value,
      theme_color:      dialog.querySelector('#pwa-theme-color').value,
      background_color: dialog.querySelector('#pwa-bg-color').value,
      icon_url:         dialog.querySelector('#pwa-icon').value,
      start_url:        dialog.querySelector('#pwa-start-url').value,
      scope:            dialog.querySelector('#pwa-scope').value,
    };
    dialog.remove();
    callback(opts);
  });

  try {
    dialog.showModal();
  } catch (e) {
    dialog.style.position = 'fixed';
    dialog.style.top = '50%';
    dialog.style.left = '50%';
    dialog.style.transform = 'translate(-50%,-50%)';
    dialog.style.zIndex = '2147483647';
    dialog.style.display = 'block';
  }
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
  getManifestDefaults(function(defaults) {
    showManifestOptionsDialog(defaults, function(opts) {
      removeCurrentManifest();
      injectManifest(opts);
    });
  });
}

function removeCustomManifest() {
  removeCurrentManifest();
}

if (!document.querySelector('link[rel="manifest"]')) {
  injectManifest(detectFromPage());
}
