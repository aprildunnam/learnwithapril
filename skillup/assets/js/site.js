/* Mobile course menu. The site-wide theme lives in /theme.js. */
(function () {
  var menu = document.getElementById("menuToggle");
  var sidebar = document.getElementById("sidebar");
  if (menu && sidebar) {
    menu.addEventListener("click", function () {
      var open = sidebar.classList.toggle("is-open");
      menu.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
})();
