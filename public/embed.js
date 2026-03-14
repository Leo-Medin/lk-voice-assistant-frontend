(function () {
  "use strict";

  // Find the script tag that loaded this file
  var currentScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();

  // Read config from data-* attributes
  var widgetUrl = (currentScript.getAttribute("data-widget-url") || "").replace(/\/$/, "");
  var title = currentScript.getAttribute("data-title") || "AI Assistant";
  var position = currentScript.getAttribute("data-position") || "bottom-right";
  var accentColor = currentScript.getAttribute("data-accent-color") || "#f97316";
  var zIndex = parseInt(currentScript.getAttribute("data-z-index") || "9999", 10);

  // Derive iframe src from widgetUrl (same origin if not provided)
  var iframeSrc =
    widgetUrl +
    "/widget?title=" +
    encodeURIComponent(title);

  // Event listeners map
  var listeners = {};

  function emit(event, data) {
    var handlers = listeners[event];
    if (handlers) {
      handlers.forEach(function (fn) {
        try {
          fn(data);
        } catch (e) {
          console.error("[LkWidget] listener error", e);
        }
      });
    }
  }

  // State
  var isOpen = false;
  var iframeCreated = false;

  // DOM elements
  var fab, panel, iframe;

  // Styles
  var isRight = position !== "bottom-left";
  var edgeProp = isRight ? "right" : "left";

  function injectStyles() {
    var style = document.createElement("style");
    style.textContent =
      "#lk-widget-fab{" +
        "position:fixed;" +
        "bottom:24px;" +
        edgeProp + ":24px;" +
        "width:60px;" +
        "height:60px;" +
        "border-radius:50%;" +
        "background:" + accentColor + ";" +
        "border:none;" +
        "cursor:pointer;" +
        "display:flex;" +
        "align-items:center;" +
        "justify-content:center;" +
        "box-shadow:0 4px 16px rgba(0,0,0,0.3);" +
        "z-index:" + zIndex + ";" +
        "transition:transform 0.2s,box-shadow 0.2s;" +
      "}" +
      "#lk-widget-fab:hover{" +
        "transform:scale(1.08);" +
        "box-shadow:0 6px 24px rgba(0,0,0,0.4);" +
      "}" +
      "#lk-widget-panel{" +
        "position:fixed;" +
        "bottom:96px;" +
        edgeProp + ":24px;" +
        "width:380px;" +
        "height:650px;" +
        "border-radius:16px;" +
        "overflow:hidden;" +
        "box-shadow:0 8px 40px rgba(0,0,0,0.4);" +
        "z-index:" + (zIndex - 1) + ";" +
        "transform-origin:bottom " + (isRight ? "right" : "left") + ";" +
        "transition:opacity 0.25s,transform 0.25s;" +
        "opacity:0;" +
        "transform:scale(0.9) translateY(16px);" +
        "pointer-events:none;" +
      "}" +
      "#lk-widget-panel.lk-open{" +
        "opacity:1;" +
        "transform:scale(1) translateY(0);" +
        "pointer-events:all;" +
      "}" +
      "#lk-widget-iframe{" +
        "width:100%;" +
        "height:100%;" +
        "border:none;" +
        "display:block;" +
      "}";
    document.head.appendChild(style);
  }

  function createFab() {
    fab = document.createElement("button");
    fab.id = "lk-widget-fab";
    fab.setAttribute("aria-label", "Open AI Assistant");
    fab.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>' +
        '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>' +
        '<line x1="12" y1="19" x2="12" y2="22"/>' +
      "</svg>";
    fab.addEventListener("click", toggle);
    document.body.appendChild(fab);
  }

  function createPanel() {
    panel = document.createElement("div");
    panel.id = "lk-widget-panel";
    document.body.appendChild(panel);
  }

  function ensureIframe() {
    if (iframeCreated) return;
    iframeCreated = true;

    iframe = document.createElement("iframe");
    iframe.id = "lk-widget-iframe";
    iframe.src = iframeSrc;
    iframe.allow = "microphone";
    iframe.setAttribute("allowtransparency", "true");
    panel.appendChild(iframe);
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    ensureIframe();
    panel.classList.add("lk-open");
    fab.setAttribute("aria-label", "Close AI Assistant");
    emit("open", null);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove("lk-open");
    fab.setAttribute("aria-label", "Open AI Assistant");
    emit("close", null);
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  // Listen for postMessage events from the iframe
  window.addEventListener("message", function (event) {
    // Accept messages from the configured widget URL or same origin
    if (widgetUrl && event.origin !== new URL(widgetUrl).origin) return;

    var data = event.data;
    if (!data || typeof data.type !== "string") return;
    if (!data.type.startsWith("lk-widget:")) return;

    var eventName = data.type.replace("lk-widget:", "");

    if (data.type === "lk-widget:closed") {
      close();
    }

    emit(eventName, data);
  });

  // Public API
  window.LkWidget = {
    open: open,
    close: close,
    toggle: toggle,
    on: function (event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    off: function (event, fn) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(function (f) {
        return f !== fn;
      });
    },
  };

  // Init once DOM is ready
  function init() {
    injectStyles();
    createFab();
    createPanel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
