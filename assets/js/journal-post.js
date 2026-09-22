(function () {
  "use strict";

  var SLUG = window.__JOURNAL_SLUG__;
  var FILE = window.__JOURNAL_FILE__;
  var BOOKMARK_KEY = "journal-bookmarks";
  var READING_PREFS_KEY = "journal-reading-prefs";

  /* ---------- Fetch + render the markdown body ---------- */

  function stripFrontMatter(raw) {
    var m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    return m ? m[2] : raw;
  }

  // Pull out :::type ... ::: callout blocks BEFORE handing the rest to
  // marked, render each callout's inner markdown separately, and splice
  // the resulting HTML back in via placeholder tokens. This avoids any
  // ambiguity around parsing markdown nested inside a raw HTML block.
  function extractCallouts(md) {
    var callouts = [];
    var replaced = md.replace(/:::(tip|note|warning|info)\r?\n([\s\S]*?):::/g, function (_, type, inner) {
      var token = "@@CALLOUT_" + callouts.length + "@@";
      callouts.push({ type: type, inner: inner.trim() });
      return token;
    });
    return { replaced: replaced, callouts: callouts };
  }

  var CALLOUT_LABEL = { tip: "نکته", note: "یادداشت", warning: "هشدار", info: "اطلاعات" };

  function renderBody(markdown) {
    var extracted = extractCallouts(markdown);
    var html;
    if (window.marked) {
      html = window.marked.parse(extracted.replaced);
    } else {
      // Defensive fallback if the marked.js CDN is ever unreachable —
      // keeps the text readable instead of dumping raw markdown syntax.
      html =
        '<p style="color:var(--ink-text-mute);font-size:.85em;margin-bottom:1em">' +
        "متن این نوشته به‌طور کامل بارگذاری نشد؛ نسخه‌ی ساده در ادامه نمایش داده می‌شود." +
        "</p><div style=\"white-space:pre-wrap\">" +
        escapeHtmlBasic(extracted.replaced) +
        "</div>";
    }

    extracted.callouts.forEach(function (c, i) {
      var innerHtml = window.marked ? window.marked.parse(c.inner) : escapeHtmlBasic(c.inner);
      var block =
        '<div class="callout callout-' + c.type + '"><div><strong>' +
        (CALLOUT_LABEL[c.type] || c.type) +
        "</strong><br>" +
        innerHtml +
        "</div></div>";
      html = html.replace(new RegExp("(<p>)?@@CALLOUT_" + i + "@@(</p>)?"), block);
    });

    return html;
  }

  function escapeHtmlBasic(s) {
    return String(s || "").replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }

  function addCodeCopyButtons(container) {
    container.querySelectorAll("pre > code").forEach(function (codeEl) {
      var pre = codeEl.parentElement;
      var btn = document.createElement("button");
      btn.className = "code-copy-btn";
      btn.type = "button";
      btn.textContent = "کپی";
      btn.addEventListener("click", function () {
        navigator.clipboard.writeText(codeEl.textContent).then(function () {
          btn.textContent = "کپی شد ✓";
          btn.classList.add("is-copied");
          setTimeout(function () {
            btn.textContent = "کپی";
            btn.classList.remove("is-copied");
          }, 1600);
        });
      });
      pre.style.position = "relative";
      pre.appendChild(btn);
    });
  }

  function loadBody() {
    var bodyEl = document.getElementById("post-body");
    if (!SLUG || !FILE) return;
    fetch("../_posts/" + FILE)
      .then(function (r) {
        if (!r.ok) throw new Error("post fetch failed");
        return r.text();
      })
      .then(function (raw) {
        var markdown = stripFrontMatter(raw);
        bodyEl.innerHTML = renderBody(markdown);
        addCodeCopyButtons(bodyEl);
        document.querySelectorAll(".reveal:not(.is-visible)").forEach(function (el) {
          el.classList.add("is-visible");
        });
      })
      .catch(function () {
        bodyEl.innerHTML = "<p>متن این نوشته بارگذاری نشد.</p>";
      });
  }

  /* ---------- Reading progress ---------- */

  function initReadingProgress() {
    var bar = document.getElementById("reading-progress-bar");
    var article = document.querySelector("main article");
    if (!bar || !article) return;
    window.addEventListener(
      "scroll",
      function () {
        var rect = article.getBoundingClientRect();
        var total = rect.height - window.innerHeight;
        var scrolled = -rect.top;
        var pct = total > 0 ? Math.min(100, Math.max(0, (scrolled / total) * 100)) : 0;
        bar.style.width = pct + "%";
      },
      { passive: true }
    );
  }

  /* ---------- Bookmark ---------- */

  function initBookmark() {
    var btn = document.getElementById("btn-bookmark");
    if (!btn || !SLUG) return;
    function getBookmarks() {
      try {
        return JSON.parse(localStorage.getItem(BOOKMARK_KEY) || "[]");
      } catch (e) {
        return [];
      }
    }
    function isBookmarked() {
      return getBookmarks().indexOf(SLUG) !== -1;
    }
    function paint() {
      var on = isBookmarked();
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
      btn.querySelector("svg").setAttribute("fill", on ? "currentColor" : "none");
    }
    paint();
    btn.addEventListener("click", function () {
      var list = getBookmarks();
      var i = list.indexOf(SLUG);
      if (i === -1) list.push(SLUG);
      else list.splice(i, 1);
      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(list));
      paint();
    });
  }

  /* ---------- Share ---------- */

  function initShare() {
    var btn = document.getElementById("btn-share");
    var panel = document.getElementById("share-panel");
    if (!btn || !panel) return;

    var url = window.location.href;
    var title = document.title.replace(/\s*\|\s*ژورنال ابوالفضل نعیمی\s*$/, "");

    var nativeBtn = document.getElementById("share-native");
    if (navigator.share) {
      nativeBtn.style.display = "flex";
      nativeBtn.addEventListener("click", function () {
        navigator.share({ title: title, url: url }).catch(function () {});
      });
    }

    var xLink = document.getElementById("share-x");
    if (xLink) xLink.href = "https://twitter.com/intent/tweet?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent(title);
    var liLink = document.getElementById("share-linkedin");
    if (liLink) liLink.href = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(url);
    var tgLink = document.getElementById("share-telegram");
    if (tgLink) tgLink.href = "https://t.me/share/url?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent(title);

    var copyBtn = document.getElementById("share-copy");
    var copyLabel = document.getElementById("share-copy-label");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        navigator.clipboard.writeText(url).then(function () {
          copyLabel.textContent = "کپی شد ✓";
          copyBtn.classList.add("sp-copied");
          setTimeout(function () {
            copyLabel.textContent = "کپی لینک";
            copyBtn.classList.remove("sp-copied");
          }, 1600);
        });
      });
    }

    btn.addEventListener("click", function () {
      panel.classList.toggle("is-open");
    });
    document.addEventListener("click", function (e) {
      if (!panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove("is-open");
      }
    });
  }

  /* ---------- Reading mode + text settings ---------- */

  function getReadingPrefs() {
    try {
      return Object.assign(
        { fontStep: 0, leadingStep: 0, widthStep: 0, readingMode: false },
        JSON.parse(localStorage.getItem(READING_PREFS_KEY) || "{}")
      );
    } catch (e) {
      return { fontStep: 0, leadingStep: 0, widthStep: 0, readingMode: false };
    }
  }
  function saveReadingPrefs(prefs) {
    localStorage.setItem(READING_PREFS_KEY, JSON.stringify(prefs));
  }
  function applyReadingPrefs(prefs) {
    var body = document.getElementById("post-body");
    if (!body) return;
    var baseFont = 1.05,
      baseLeading = 1.95,
      baseWidth = 70;
    body.style.fontSize = baseFont + prefs.fontStep * 0.08 + "rem";
    body.style.lineHeight = String(baseLeading + prefs.leadingStep * 0.15);
    body.style.maxWidth = baseWidth + prefs.widthStep * 6 + "ch";
    document.documentElement.classList.toggle("reading-mode", !!prefs.readingMode);
    var modeBtn = document.getElementById("btn-reading-mode");
    if (modeBtn) modeBtn.setAttribute("aria-pressed", String(!!prefs.readingMode));
    if (modeBtn) modeBtn.classList.toggle("is-active", !!prefs.readingMode);
  }

  function initReadingSettings() {
    var prefs = getReadingPrefs();
    applyReadingPrefs(prefs);

    var modeBtn = document.getElementById("btn-reading-mode");
    if (modeBtn) {
      modeBtn.addEventListener("click", function () {
        prefs.readingMode = !prefs.readingMode;
        saveReadingPrefs(prefs);
        applyReadingPrefs(prefs);
      });
    }

    var settingsBtn = document.getElementById("btn-text-settings");
    var panel = document.getElementById("reading-settings");
    if (settingsBtn && panel) {
      settingsBtn.addEventListener("click", function () {
        panel.classList.toggle("is-open");
      });
      document.addEventListener("click", function (e) {
        if (!panel.contains(e.target) && !settingsBtn.contains(e.target)) {
          panel.classList.remove("is-open");
        }
      });
      panel.querySelectorAll("[data-font]").forEach(function (b) {
        b.addEventListener("click", function () {
          prefs.fontStep += b.getAttribute("data-font") === "+" ? 1 : -1;
          prefs.fontStep = Math.max(-2, Math.min(4, prefs.fontStep));
          saveReadingPrefs(prefs);
          applyReadingPrefs(prefs);
        });
      });
      panel.querySelectorAll("[data-leading]").forEach(function (b) {
        b.addEventListener("click", function () {
          prefs.leadingStep += b.getAttribute("data-leading") === "+" ? 1 : -1;
          prefs.leadingStep = Math.max(-2, Math.min(3, prefs.leadingStep));
          saveReadingPrefs(prefs);
          applyReadingPrefs(prefs);
        });
      });
      panel.querySelectorAll("[data-width]").forEach(function (b) {
        b.addEventListener("click", function () {
          prefs.widthStep += b.getAttribute("data-width") === "+" ? 1 : -1;
          prefs.widthStep = Math.max(-3, Math.min(3, prefs.widthStep));
          saveReadingPrefs(prefs);
          applyReadingPrefs(prefs);
        });
      });
    }
  }

  /* ---------- Lightbox (gallery) ---------- */

  function initLightbox() {
    var lightbox = document.getElementById("lightbox");
    var img = document.getElementById("lightbox-img");
    var closeBtn = document.getElementById("lightbox-close");
    if (!lightbox || !img) return;

    document.addEventListener("click", function (e) {
      var trigger = e.target.closest("[data-lightbox-src]");
      if (!trigger) return;
      img.src = trigger.getAttribute("data-lightbox-src");
      lightbox.classList.add("is-open");
    });
    function close() {
      lightbox.classList.remove("is-open");
      img.src = "";
    }
    if (closeBtn) closeBtn.addEventListener("click", close);
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  function init() {
    loadBody();
    initReadingProgress();
    initBookmark();
    initShare();
    initReadingSettings();
    initLightbox();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
