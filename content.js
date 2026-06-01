console.log("[PWA Scope Fixer] Content script loaded.");window.__pwa_deferred_prompt__=null;window.addEventListener("beforeinstallprompt",(F)=>{F.preventDefault(),window.__pwa_deferred_prompt__=F,console.log("[PWA Scope Fixer] Captured beforeinstallprompt")});(async()=>{try{let F=window.location.hostname,G=await chrome.storage.local.get(["siteSettings","autoScopeFix"]),Y=G.siteSettings||{};if(G.autoScopeFix!==!1&&Y[F]){console.log("[PWA Scope Fixer] Auto-injecting manifest for:",F),(()=>{document.querySelectorAll('link[rel="manifest"]').forEach(($)=>$.remove())})();let V=new MutationObserver((Z)=>{for(let $ of Z)$.addedNodes.forEach((A)=>{if(A instanceof HTMLLinkElement&&A.rel==="manifest")console.log("[PWA Scope Fixer] Intercepted manifest link, removing"),A.remove()})});if(V.observe(document.documentElement,{childList:!0,subtree:!0}),document.readyState==="loading")document.addEventListener("DOMContentLoaded",async()=>{V.disconnect(),await K(Y[F])});else V.disconnect(),await K(Y[F])}}catch(F){console.warn("[PWA Scope Fixer] Auto-inject error:",F)}})();function O(F){if(!F)return null;if(F.startsWith("#"))return F;let G=F.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);if(!G)return null;let Y=parseInt(G[1]||"0",10),X=parseInt(G[2]||"0",10),N=parseInt(G[3]||"0",10);return`#${(16777216+(Y<<16)+(X<<8)+N).toString(16).slice(1)}`}async function W(){let F=document.querySelector('meta[name="theme-color"]'),G=F?F.getAttribute("content"):null,X=window.getComputedStyle(document.body).backgroundColor,N=X!=="rgba(0, 0, 0, 0)"&&X!=="transparent"?O(X)||"#ffffff":"#ffffff",V=await U();return{name:document.title||"Fixed PWA",short_name:document.title||"Fixed PWA",background_color:N,theme_color:O(G||"")||G,icons:V}}async function U(){let F=[],G=await D();if(G?.icons&&Array.isArray(G.icons))G.icons.forEach((N)=>{F.push({src:new URL(N.src,window.location.origin).href,sizes:N.sizes||"unknown",type:N.type||"image/png",purpose:N.purpose})});Array.from(document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')).forEach((N)=>{let V=N.href;if(V&&!F.some((Z)=>Z.src===V))F.push({src:V,sizes:N.getAttribute("sizes")||"unknown",type:N.getAttribute("type")||"image/png"})});let X=["/favicon.ico","/favicon.png","/apple-touch-icon.png"];for(let N of X){let V=new URL(N,window.location.origin).href;if(!F.some((Z)=>Z.src===V))try{if((await fetch(V,{method:"HEAD"})).ok)F.push({src:V,sizes:"unknown",type:N.endsWith(".ico")?"image/x-icon":"image/png"})}catch{}}return F}async function D(){let F=document.querySelector('link[rel="manifest"]');if(!F||!F.href)return null;try{console.log("[PWA Scope Fixer] Fetching existing manifest from:",F.href);let G=await fetch(F.href);if(!G.ok)return console.warn("[PWA Scope Fixer] Failed to fetch existing manifest:",G.status),null;let Y=await G.json();return console.log("[PWA Scope Fixer] Existing manifest:",Y),Y}catch(G){return console.warn("[PWA Scope Fixer] Error fetching existing manifest:",G),null}}async function K(F){console.log("[PWA Scope Fixer] Injecting manifest with settings:",F);let G=await D(),Y={createHTML:(Q)=>Q};if(window.trustedTypes&&window.trustedTypes.createPolicy)try{Y=window.trustedTypes.createPolicy("pwa-scope-fixer",{createHTML:(Q)=>Q})}catch(Q){console.warn("[PWA Scope Fixer] Policy creation failed (likely exists):",Q)}document.querySelectorAll('link[rel="manifest"]').forEach((Q)=>Q.remove());let N=[];if(F.customIconUrl&&F.customIconUrl.trim()!==""){console.log("[PWA Scope Fixer] Using custom icon URL:",F.customIconUrl);N=[{src:F.customIconUrl,sizes:"192x192",type:"image/png"},{src:F.customIconUrl,sizes:"512x512",type:"image/png"}];}else if(F.selectedIcons&&F.selectedIcons.length>0)console.log("[PWA Scope Fixer] Using selected icons:",F.selectedIcons.length),N=F.selectedIcons.map((Q)=>({src:Q.src,sizes:Q.sizes==="unknown"?"192x192":Q.sizes,type:Q.type||"image/png",...Q.purpose&&{purpose:Q.purpose}}));else if(G?.icons&&Array.isArray(G.icons)&&G.icons.length>0)console.log("[PWA Scope Fixer] Using icons from existing manifest"),N=G.icons.map((Q)=>({...Q,src:new URL(Q.src,window.location.origin).href}));else N=Array.from(document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')).map((_)=>{let z=_.getAttribute("sizes"),E=_.getAttribute("type")||"image/png";return{src:_.href,sizes:z||"192x192",type:E}}).filter((_)=>_.src);if(N.length===0){console.log("[PWA Scope Fixer] No icons found, using fallback icon");let Q=(()=>{let _=document.createElement("canvas");_.width=192,_.height=192;let z=_.getContext("2d");if(z)z.fillStyle="#3383db",z.fillRect(0,0,192,192),z.fillStyle="#FFFFFF",z.font="bold 80px sans-serif",z.textAlign="center",z.textBaseline="middle",z.fillText("PWA",96,96);return _.toDataURL("image/png")})();N.push({src:Q,sizes:"192x192",type:"image/png"},{src:Q,sizes:"512x512",type:"image/png"})}let V=await W(),Z={...G,start_url:F.startUrl,display:F.display||"fullscreen",name:F.name||G?.name||V.name,short_name:F.shortName||G?.short_name||V.short_name,background_color:F.backgroundColor||G?.background_color||V.background_color,icons:N};if(F.displayOverride&&F.displayOverride.length>0)Z.display_override=F.displayOverride,console.log("[PWA Scope Fixer] Display override set to:",F.displayOverride);else delete Z.display_override;let $=F.themeColor||G?.theme_color||V.theme_color;if($)Z.theme_color=$;F.scopeUrl?Z.scope=F.scopeUrl:delete Z.scope,console.log("[PWA Scope Fixer] Final manifest:",Z);let A=JSON.stringify(Z),H=`data:application/manifest+json,${encodeURIComponent(A)}`;if($){document.querySelectorAll('meta[name="theme-color"]').forEach((_)=>_.remove());let Q=document.createElement("meta");Q.name="theme-color",Q.content=$,document.head?.appendChild(Q),console.log("[PWA Scope Fixer] Theme color set to:",$)}let T=`<link rel="manifest" href='${H}' />`;try{(document.head||document.documentElement).insertAdjacentHTML("afterbegin",Y.createHTML(T)),console.log("[PWA Scope Fixer] Injection Complete")}catch(Q){console.error("[PWA Scope Fixer] Injection Failed:",Q)}if(F.displayOverride?.includes("window-controls-overlay"))j($)}function j(F){document.getElementById("pwa-scope-fixer-wco-styles")?.remove();let X=`
    /* PWA Scope Fixer - Window Controls Overlay Styles */
    
    /* Titlebar area - use CSS environment variables */
    .pwa-titlebar {
      position: fixed;
      top: 0;
      left: env(titlebar-area-x, 0);
      width: env(titlebar-area-width, 100%);
      height: env(titlebar-area-height, 33px);
      background-color: ${F||"#ffffff"};
      -webkit-app-region: drag;
      app-region: drag;
      z-index: 9999;
      display: flex;
      align-items: center;
      padding: 0 16px;
      box-sizing: border-box;
    }

    /* Make buttons/links in titlebar clickable */
    .pwa-titlebar button,
    .pwa-titlebar a,
    .pwa-titlebar input,
    .pwa-titlebar [data-no-drag] {
      -webkit-app-region: no-drag;
      app-region: no-drag;
    }

    /* Add padding to body when WCO is active */
    @media (display-mode: window-controls-overlay) {
      body {
        padding-top: env(titlebar-area-height, 33px) !important;
      }
      
      /* Ensure fixed elements account for titlebar */
      body > header:first-of-type,
      body > nav:first-of-type,
      [class*="header"],
      [class*="navbar"],
      [class*="topbar"],
      [class*="app-bar"] {
        margin-top: env(titlebar-area-height, 33px);
      }
    }

    /* Fallback padding when not in WCO mode */
    @supports not (padding-top: env(titlebar-area-height)) {
      .pwa-titlebar {
        display: none;
      }
    }

    /* Custom Scrollbar - Modern style */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: rgba(128, 128, 128, 0.4);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: rgba(128, 128, 128, 0.6);
    }

    ::-webkit-scrollbar-corner {
      background: transparent;
    }

    /* Firefox scrollbar */
    * {
      scrollbar-width: thin;
      scrollbar-color: rgba(128, 128, 128, 0.4) transparent;
    }
  `,N=document.createElement("style");N.id="pwa-scope-fixer-wco-styles",N.textContent=X,document.head?.appendChild(N),console.log("[PWA Scope Fixer] WCO styles injected")}function L(){if(document.getElementById("pwa-scope-fixer-modal"))return;let G=document.createElement("div");G.id="pwa-scope-fixer-modal",G.style.cssText=`
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1), 0 10px 15px rgba(0,0,0,0.1);
    z-index: 10000;
    max-width: 400px;
    font-family: system-ui, -apple-system, sans-serif;
    text-align: center;
    color: #333;
  `;let Y=document.createElement("h3");Y.innerText="PWA Install Prompt Not Ready",Y.style.marginTop="0",Y.style.marginBottom="10px";let X=document.createElement("p");X.innerText=`If you just applied the fix, please REFRESH the page to enable installation.

If installation fails, try deleting existing apps in chrome://apps/ (copy and paste into address bar)`,X.style.marginBottom="20px",X.style.lineHeight="1.5",X.style.whiteSpace="pre-wrap",X.style.userSelect="text";let N=document.createElement("div");N.style.display="flex",N.style.justifyContent="center",N.style.gap="10px";let V=document.createElement("button");V.innerText="Close",V.style.padding="8px 16px",V.style.cursor="pointer",V.style.border="1px solid #ccc",V.style.borderRadius="4px",V.style.backgroundColor="#fff",V.onclick=()=>G.remove(),N.appendChild(V),G.appendChild(Y),G.appendChild(X),G.appendChild(N),document.body.appendChild(G)}chrome.runtime.onMessage.addListener((F,G,Y)=>{if(F.action==="fix_scope")K(F.settings),Y({success:!0});else if(F.action==="trigger_install"){console.log("[PWA Scope Fixer] Received trigger_install message");let X=window.__pwa_deferred_prompt__;if(X)X.prompt(),X.userChoice.then((N)=>{if(N.outcome==="accepted")console.log("[PWA Scope Fixer] User accepted the A2HS prompt");else console.log("[PWA Scope Fixer] User dismissed the A2HS prompt");window.__pwa_deferred_prompt__=null});else L()}else if(F.action==="check_install_status")Y({ready:!!window.__pwa_deferred_prompt__});else if(F.action==="get_manifest_defaults")return W().then((X)=>{Y(X)}),!0});
