(function () {
  "use strict";

  /* Mobile nav toggle */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* Scroll reveal */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });
    /* Safety net: never leave content permanently hidden (slow scroll, odd viewports, bots) */
    setTimeout(function () {
      revealEls.forEach(function (el) {
        el.classList.add("is-visible");
      });
    }, 2500);
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* Back to top */
  var toTop = document.querySelector(".to-top");
  if (toTop) {
    window.addEventListener(
      "scroll",
      function () {
        if (window.scrollY > 560) {
          toTop.classList.add("is-shown");
        } else {
          toTop.classList.remove("is-shown");
        }
      },
      { passive: true }
    );
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* Project filters (projects page) */
  var filterRow = document.querySelector("[data-filters]");
  var cards = document.querySelectorAll("[data-project]");
  if (filterRow && cards.length) {
    filterRow.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;
      filterRow
        .querySelectorAll(".filter-btn")
        .forEach(function (b) {
          b.classList.remove("is-active");
          b.setAttribute("aria-pressed", "false");
        });
      btn.classList.add("is-active");
      btn.setAttribute("aria-pressed", "true");
      var f = btn.getAttribute("data-filter");
      cards.forEach(function (card) {
        var tags = (card.getAttribute("data-tags") || "").split(",");
        var show = f === "all" || tags.indexOf(f) !== -1;
        card.style.display = show ? "" : "none";
      });
    });
  }

  /* Animated stat counters */
  var statEls = document.querySelectorAll("[data-count]");
  if (statEls.length) {
    var animateCount = function (el) {
      var target = parseInt(el.getAttribute("data-count"), 10);
      var suffix = el.getAttribute("data-suffix") || "";
      var duration = 1100;
      var start = null;
      function step(ts) {
        if (!start) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target) + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    };
    if ("IntersectionObserver" in window) {
      var statIo = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              animateCount(entry.target);
              statIo.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );
      statEls.forEach(function (el) {
        statIo.observe(el);
      });
    } else {
      statEls.forEach(function (el) {
        el.textContent = el.getAttribute("data-count") + (el.getAttribute("data-suffix") || "");
      });
    }
  }

  /* Contact form — AJAX submit to Formspree with inline success/error message */
  var contactForm = document.querySelector("#contact-form");
  if (contactForm) {
    var statusEl = contactForm.querySelector("#form-status");
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var submitBtn = contactForm.querySelector('button[type="submit"]');
      var originalLabel = submitBtn.textContent;
      submitBtn.disabled = true;
      statusEl.className = "";
      statusEl.style.display = "none";

      fetch(contactForm.action, {
        method: "POST",
        body: new FormData(contactForm),
        headers: { Accept: "application/json" },
      })
        .then(function (response) {
          if (response.ok) {
            statusEl.textContent =
              document.documentElement.lang === "fa"
                ? "پیام شما با موفقیت ارسال شد."
                : "Your message was sent successfully.";
            statusEl.className = "is-success";
            contactForm.reset();
          } else {
            return response.json().then(function (data) {
              throw new Error(
                data && data.errors
                  ? data.errors.map(function (er) { return er.message; }).join(", ")
                  : "Submit failed"
              );
            });
          }
        })
        .catch(function () {
          statusEl.textContent =
            document.documentElement.lang === "fa"
              ? "ارسال پیام ناموفق بود. لطفاً دوباره تلاش کنید یا مستقیم ایمیل بزنید."
              : "Something went wrong. Please try again or email me directly.";
          statusEl.className = "is-error";
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        });
    });
  }

  /* Nav active-indicator */
  var navLinksEl = document.querySelector(".nav-links");
  if (navLinksEl) {
    var indicator = document.createElement("span");
    indicator.className = "nav-indicator";
    indicator.setAttribute("aria-hidden", "true");
    navLinksEl.appendChild(indicator);
    var moveIndicator = function (el) {
      indicator.style.left = el.offsetLeft + "px";
      indicator.style.width = el.offsetWidth + "px";
    };
    var navAnchors = navLinksEl.querySelectorAll("a");
    navAnchors.forEach(function (a) {
      a.addEventListener("mouseenter", function () {
        moveIndicator(a);
      });
    });
    var current = navLinksEl.querySelector('a[aria-current="page"]');
    if (current) moveIndicator(current);
    navLinksEl.addEventListener("mouseleave", function () {
      if (current) moveIndicator(current);
    });
  }

  /* Easter Egg — hidden, not advertised in the UI.
     Desktop: type B U I L D on a physical keyboard (each key within 700ms
     of the last). Mobile: press and hold the logo/monogram for ~1.2s.
     Only wires up if the overlay markup is present on the page. */
  var egg = document.getElementById("easter-egg");
  if (egg) {
    var eggPanel = egg.querySelector(".egg-panel");
    var eggTrigger = null;

    function openEgg(triggerEl) {
      eggTrigger = triggerEl || null;
      egg.classList.add("is-open");
      egg.setAttribute("aria-hidden", "false");
      var closeBtn = egg.querySelector(".egg-close");
      if (closeBtn) closeBtn.focus();
      document.addEventListener("keydown", onEggKeydown);
    }
    function closeEgg() {
      egg.classList.remove("is-open");
      egg.setAttribute("aria-hidden", "true");
      document.removeEventListener("keydown", onEggKeydown);
      if (eggTrigger && eggTrigger.focus) eggTrigger.focus();
    }
    function onEggKeydown(e) {
      if (e.key === "Escape") closeEgg();
    }

    var closeBtn = egg.querySelector(".egg-close");
    if (closeBtn) closeBtn.addEventListener("click", function () { closeEgg(); });
    egg.addEventListener("click", function (e) {
      if (e.target === egg) closeEgg();
    });

    // Desktop: keyboard sequence B-U-I-L-D
    var SEQUENCE = ["b", "u", "i", "l", "d"];
    var buffer = [];
    var lastKeyTime = 0;
    document.addEventListener("keydown", function (e) {
      if (egg.classList.contains("is-open")) return;
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      var now = Date.now();
      if (now - lastKeyTime > 700) buffer = [];
      lastKeyTime = now;
      buffer.push(e.key.toLowerCase());
      buffer = buffer.slice(-SEQUENCE.length);
      if (buffer.join("") === SEQUENCE.join("")) {
        buffer = [];
        openEgg(document.activeElement);
      }
    });

    // Mobile/touch: press and hold the logo for ~1.2s (a normal tap still
    // navigates as usual; the hold is what opens it)
    var brandEl = document.querySelector(".site-header .brand");
    if (brandEl) {
      var holdTimer = null;
      var heldOpen = false;
      brandEl.style.webkitTouchCallout = "none";
      brandEl.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse") return;
        heldOpen = false;
        holdTimer = setTimeout(function () {
          heldOpen = true;
          openEgg(brandEl);
        }, 1200);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) {
        brandEl.addEventListener(ev, function () {
          clearTimeout(holdTimer);
        });
      });
      brandEl.addEventListener("click", function (e) {
        if (heldOpen) {
          e.preventDefault();
          heldOpen = false;
        }
      });
      brandEl.addEventListener("contextmenu", function (e) {
        if (heldOpen) e.preventDefault();
      });
    }
  }

  /* Footer year */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
