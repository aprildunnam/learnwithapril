/* Learn with April - one light/dark theme for the whole site.
   Loads in <head> so the right theme paints first. Follows the system
   setting until someone picks a mode with the header toggle. */
(function () {
  var KEY = "lwa-theme";
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function saved() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" ? v : null;
    } catch (e) { return null; }
  }
  function current() {
    return saved() || (media && media.matches ? "dark" : "light");
  }
  function sync() {
    var dark = root.getAttribute("data-theme") === "dark";
    var buttons = document.querySelectorAll("[data-lwa-theme-toggle]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", dark ? "true" : "false");
      buttons[i].setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      buttons[i].title = dark ? "Switch to light mode" : "Switch to dark mode";
    }
  }
  function apply() {
    root.setAttribute("data-theme", current());
    sync();
  }

  apply();
  if (media && media.addEventListener) media.addEventListener("change", apply);
  window.addEventListener("storage", function (e) { if (e.key === KEY || e.key === null) apply(); });
  document.addEventListener("DOMContentLoaded", sync);
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-lwa-theme-toggle]");
    if (!btn) return;
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, next); } catch (err) { /* private window */ }
    root.setAttribute("data-theme", next);
    sync();
  });
})();
