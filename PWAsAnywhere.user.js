// ==UserScript==
// @name        PWA Manifest Editor
// @match       *://*/*
// @version     2.0.0
// @license     ISC
// @description Edit PWA Manifest
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

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showManifestOptionsDialog(defaults, callback) {
  var oldHost = document.getElementById('pwa-anywhere-host');
  if (oldHost) oldHost.remove();

  // Attach to documentElement via shadow DOM — bypasses SPA body monitoring (e.g. Gmail)
  var host = document.createElement('div');
  host.id = 'pwa-anywhere-host';
  document.documentElement.appendChild(host);
  var shadow = host.attachShadow({ mode: 'open' });

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
      inputHtml = '<select id="' + f.id + '">';
      f.options.forEach(function(o) {
        inputHtml += '<option value="' + o.value + '"' + (o.value === f.value ? ' selected' : '') + '>' + o.label + '</option>';
      });
      inputHtml += '</select>';
    } else if (f.type === 'color') {
      inputHtml = '<div class="color-wrap">'
        + '<input type="color" id="' + f.id + '" value="' + escapeAttr(f.value) + '">'
        + '<span id="' + f.id + '-hex">' + escapeAttr(f.value) + '</span>'
        + '</div>';
    } else {
      inputHtml = '<input type="text" id="' + f.id + '" value="' + escapeAttr(f.value) + '">';
    }
    return '<div class="field">'
      + '<label for="' + f.id + '">' + f.label + '</label>'
      + inputHtml
      + '<small>' + f.hint + '</small>'
      + '</div>';
  }).join('');

  shadow.innerHTML = '<style>'
    + ':host{all:initial}'
    + '*{box-sizing:border-box;font-family:system-ui,sans-serif}'
    + '#overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center}'
    + '#modal{background:#fff;color:#111;border-radius:10px;box-shadow:0 6px 32px rgba(0,0,0,.4);max-width:480px;width:min(90vw,480px);max-height:90vh;overflow:auto;font-size:14px;line-height:1.5}'
    + '#hdr{padding:20px 22px 18px;background:#f8f9fa;border-bottom:1px solid #e0e0e0;border-radius:10px 10px 0 0}'
    + '#hdr .title{font-weight:700;font-size:16px;color:#111}'
    + '#hdr .host{font-size:12px;color:#888;margin-top:2px}'
    + 'form{display:flex;flex-direction:column;gap:12px;padding:18px 22px}'
    + '.field{display:flex;flex-direction:column;gap:4px}'
    + 'label{font-weight:600;font-size:13px;color:#333}'
    + 'input[type=text],select{width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:5px;font-size:13px;color:#111;background:#fff}'
    + '.color-wrap{display:flex;align-items:center;gap:10px}'
    + 'input[type=color]{width:48px;height:34px;padding:2px 3px;border:1px solid #ccc;border-radius:5px;cursor:pointer;background:#fff}'
    + '.color-wrap span{font-size:12px;color:#555;font-family:monospace}'
    + 'small{color:#888;font-size:11px}'
    + '.actions{display:flex;justify-content:flex-end;gap:8px;padding-top:6px;border-top:1px solid #eee;margin-top:4px}'
    + 'button{padding:8px 18px;border-radius:6px;font-size:13px;cursor:pointer}'
    + '#pwa-cancel{border:1px solid #ccc;background:#f5f5f5;color:#444}'
    + 'button[type=submit]{border:none;background:#1a73e8;color:#fff;font-weight:600}'
    + '</style>'
    + '<div id="overlay">'
    +   '<div id="modal">'
    +     '<div id="hdr"><div class="title">📱 PWA Manifest Options</div><div class="host">' + location.hostname + '</div></div>'
    +     '<form id="pwa-form">'
    +       fieldsHtml
    +       '<div class="actions">'
    +         '<button type="button" id="pwa-cancel">Cancel</button>'
    +         '<button type="submit">Apply</button>'
    +       '</div>'
    +     '</form>'
    +   '</div>'
    + '</div>';

  ['pwa-theme-color', 'pwa-bg-color'].forEach(function(id) {
    var input = shadow.querySelector('#' + id);
    var hexLabel = shadow.querySelector('#' + id + '-hex');
    if (input && hexLabel) {
      input.addEventListener('input', function() { hexLabel.textContent = input.value; });
    }
  });

  function close() { host.remove(); }

  shadow.querySelector('#overlay').addEventListener('click', function(e) {
    if (e.target === this) close();
  });
  shadow.querySelector('#pwa-cancel').addEventListener('click', close);
  shadow.querySelector('#pwa-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var opts = {
      name:             shadow.querySelector('#pwa-name').value,
      short_name:       shadow.querySelector('#pwa-short-name').value || undefined,
      display:          shadow.querySelector('#pwa-display').value,
      theme_color:      shadow.querySelector('#pwa-theme-color').value,
      background_color: shadow.querySelector('#pwa-bg-color').value,
      icon_url:         shadow.querySelector('#pwa-icon').value,
      start_url:        shadow.querySelector('#pwa-start-url').value,
      scope:            shadow.querySelector('#pwa-scope').value,
    };
    close();
    callback(opts);
  });
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
