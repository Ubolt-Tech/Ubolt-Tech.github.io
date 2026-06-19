/* Ubolt website redesign — interactions */
(function () {
  "use strict";

  /* ---- Rotating hero headline ---- */
  var rotword = document.getElementById("rotword");
  if (rotword) {
    var words = ["FLEET", "FREIGHT", "FINANCE"];
    var i = 0;
    var prefersReduced = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReduced) {
      setInterval(function () {
        i = (i + 1) % words.length;
        rotword.style.opacity = 0;
        setTimeout(function () {
          rotword.textContent = words[i];
          rotword.style.opacity = 1;
        }, 220);
      }, 2800);
    }
  }

  /* ---- Why-Ubolt accordion (single-open) ---- */
  var accordion = document.getElementById("accordion");
  if (accordion) {
    accordion.addEventListener("click", function (e) {
      var btn = e.target.closest(".acc-btn");
      if (!btn) return;
      var item = btn.parentElement;
      var wasOpen = item.classList.contains("open");
      accordion.querySelectorAll(".acc-item").forEach(function (el) {
        el.classList.remove("open");
      });
      if (!wasOpen) item.classList.add("open");
    });
  }

  /* ---- Mobile nav toggle ---- */
  var navToggle = document.getElementById("navToggle");
  var header = document.getElementById("siteHeader");
  if (navToggle && header) {
    navToggle.addEventListener("click", function () {
      header.classList.toggle("nav-open");
    });
    header.querySelectorAll(".nav a").forEach(function (link) {
      link.addEventListener("click", function () {
        header.classList.remove("nav-open");
      });
    });
  }

  /* ---- Newsletter (no backend yet) ---- */
  var newsletter = document.getElementById("newsletter");
  if (newsletter) {
    newsletter.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = newsletter.querySelector("input");
      var btn = newsletter.querySelector("button");
      if (input && input.value) {
        btn.textContent = "Thanks!";
        input.value = "";
        setTimeout(function () { btn.textContent = "Send"; }, 2500);
      }
    });
  }
})();
