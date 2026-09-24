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
        el.querySelector(".acc-btn").setAttribute("aria-expanded", "false");
      });
      if (!wasOpen) {
        item.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  }

  /* ---- Mobile nav toggle ---- */
  var navToggle = document.getElementById("navToggle");
  var header = document.getElementById("siteHeader");
  if (navToggle && header) {
    navToggle.addEventListener("click", function () {
      var open = header.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    header.querySelectorAll(".nav a").forEach(function (link) {
      link.addEventListener("click", function () {
        header.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---- Newsletter (no backend yet — hands off to the visitor's mail client) ---- */
  var newsletter = document.getElementById("newsletter");
  if (newsletter) {
    newsletter.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = newsletter.querySelector("input");
      var btn = newsletter.querySelector("button");
      if (input && input.value) {
        window.location.href = "mailto:contact@ubolt.tech" +
          "?subject=" + encodeURIComponent("Newsletter signup") +
          "&body=" + encodeURIComponent("Please add " + input.value + " to the Ubolt newsletter.");
        btn.textContent = "Thanks!";
        input.value = "";
        setTimeout(function () { btn.textContent = "Send"; }, 2500);
      }
    });
  }

  /* ---- Nav scrollspy ---- */
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll('.nav a[href^="#"]')
  );
  if (navLinks.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle(
            "active",
            link.getAttribute("href") === "#" + entry.target.id
          );
        });
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    navLinks.forEach(function (link) {
      var target = document.querySelector(link.getAttribute("href"));
      if (target) spy.observe(target);
    });
  }
})();
