(function () {
  "use strict";
  // AI Forma embed loader. The tenant pastes:
  //   <div id="forma-intake"></div>
  //   <script src="https://<host>/embed.js" data-forma-key="fk_..." async></script>
  var current = document.currentScript;
  if (!current) return;

  var key = current.getAttribute("data-forma-key");
  if (!key) {
    console.error("[AI Forma] missing data-forma-key on embed script");
    return;
  }

  var origin = new URL(current.src, window.location.href).origin;
  var mount =
    document.getElementById(current.getAttribute("data-forma-target") || "forma-intake") ||
    (function () {
      var d = document.createElement("div");
      current.parentNode.insertBefore(d, current);
      return d;
    })();

  var iframe = document.createElement("iframe");
  iframe.src = origin + "/w/" + encodeURIComponent(key);
  iframe.title = "Design intake";
  iframe.loading = "lazy";
  iframe.style.width = "100%";
  iframe.style.minHeight = "640px";
  iframe.style.border = "0";
  iframe.style.borderRadius = "16px";
  iframe.allow = "clipboard-write";
  mount.appendChild(iframe);

  // Optional auto-resize: the widget can post { type: "forma:height", value: <px> }.
  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !e.data || e.data.type !== "forma:height") return;
    var h = parseInt(e.data.value, 10);
    if (h > 0) iframe.style.minHeight = h + "px";
  });
})();
