(function () {
  "use strict";

  var INDEX_URL = "posts-index.json";
  var BOOKMARK_KEY = "journal-bookmarks";

  var state = {
    posts: [],
    categories: [],
    activeCategory: "all",
    query: "",
    bookmarkOnly: false,
  };

  function getBookmarks() {
    try {
      return JSON.parse(localStorage.getItem(BOOKMARK_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }
  function isBookmarked(slug) {
    return getBookmarks().indexOf(slug) !== -1;
  }
  function toggleBookmark(slug) {
    var list = getBookmarks();
    var i = list.indexOf(slug);
    if (i === -1) list.push(slug);
    else list.splice(i, 1);
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(list));
    return i === -1; // true if now bookmarked
  }

  function bookmarkIconSvg(filled) {
    return (
      '<svg viewBox="0 0 24 24" fill="' +
      (filled ? "currentColor" : "none") +
      '" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"/></svg>'
    );
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString("fa-IR-u-nu-latn", { year: "numeric", month: "long", day: "numeric" });
    } catch (e) {
      return iso;
    }
  }

  function cardTemplate(post) {
    var bookmarked = isBookmarked(post.slug);
    var cover = post.cover
      ? '<div class="jc-media"><img src="' + post.cover + '" alt="' + escapeHtml(post.title) + '" loading="lazy"></div>'
      : "";
    var seriesBadge = post.series
      ? '<span class="series-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>' +
        escapeHtml(post.series) +
        "</span>"
      : "";
    return (
      '<a class="jcard reveal" href="' +
      post.slug +
      '/" data-slug="' +
      post.slug +
      '">' +
      cover +
      '<div class="jc-body">' +
      '<div class="jc-meta">' +
      (post.category ? '<span class="jc-cat">' + escapeHtml(post.category) + "</span>" : "") +
      "<span>" + formatDate(post.date) + "</span>" +
      "</div>" +
      "<h3>" + escapeHtml(post.title) + "</h3>" +
      (post.excerpt ? "<p>" + escapeHtml(post.excerpt) + "</p>" : "") +
      seriesBadge +
      '<div class="jc-foot">' +
      "<span>" + post.readingTime + " دقیقه مطالعه</span>" +
      '<button class="jc-bookmark' +
      (bookmarked ? " is-bookmarked" : "") +
      '" data-bookmark="' +
      post.slug +
      '" aria-pressed="' +
      bookmarked +
      '" aria-label="نشان کردن پست" onclick="event.preventDefault(); event.stopPropagation();">' +
      bookmarkIconSvg(bookmarked) +
      "</button>" +
      "</div></div></a>"
    );
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderFeatured(post) {
    var slot = document.getElementById("journal-featured-slot");
    if (!post) {
      slot.innerHTML = "";
      return;
    }
    slot.innerHTML =
      '<a class="journal-featured reveal" href="' +
      post.slug +
      '/">' +
      (post.cover
        ? '<div class="jf-media"><img src="' + post.cover + '" alt="' + escapeHtml(post.title) + '" loading="eager"></div>'
        : '<div class="jf-media"></div>') +
      '<div class="jf-body">' +
      '<div class="jf-meta">' +
      '<span class="tag">Featured</span>' +
      (post.category ? "<span>" + escapeHtml(post.category) + "</span>" : "") +
      "<span>" + formatDate(post.date) + "</span>" +
      "<span>" + post.readingTime + " دقیقه مطالعه</span>" +
      "</div>" +
      "<h2>" + escapeHtml(post.title) + "</h2>" +
      (post.excerpt ? "<p>" + escapeHtml(post.excerpt) + "</p>" : "") +
      '<span class="btn btn-primary">مطالعه‌ی نوشته</span>' +
      "</div></a>";
  }

  function renderPinned(posts) {
    var slot = document.getElementById("journal-pinned-slot");
    if (!posts.length) {
      slot.innerHTML = "";
      return;
    }
    slot.innerHTML =
      '<div class="journal-pinned reveal"><h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"/></svg>سنجاق‌شده</h3><div class="pinned-row">' +
      posts.map(cardTemplate).join("") +
      "</div></div>";
  }

  function render() {
    var grid = document.getElementById("journal-grid");
    var empty = document.getElementById("journal-empty");

    var filtered = state.posts.filter(function (p) {
      if (state.bookmarkOnly && !isBookmarked(p.slug)) return false;
      if (state.activeCategory !== "all" && p.category !== state.activeCategory) return false;
      if (state.query) {
        var q = state.query.toLowerCase();
        var hay = [p.title, p.subtitle, p.excerpt, (p.tags || []).join(" "), p.category || ""].join(" ").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    var showFeaturedPinned = state.activeCategory === "all" && !state.query && !state.bookmarkOnly;

    var featured = showFeaturedPinned ? state.posts.find(function (p) { return p.featured; }) : null;
    var pinned = showFeaturedPinned ? state.posts.filter(function (p) { return p.pinned && (!featured || p.slug !== featured.slug); }) : [];

    renderFeatured(featured);
    renderPinned(pinned);

    var gridPosts = filtered.filter(function (p) {
      if (!showFeaturedPinned) return true;
      if (featured && p.slug === featured.slug) return false;
      if (pinned.some(function (pp) { return pp.slug === p.slug; })) return false;
      return true;
    });

    if (gridPosts.length === 0 && !featured && pinned.length === 0) {
      grid.innerHTML = "";
      empty.style.display = "block";
    } else {
      empty.style.display = "none";
      grid.innerHTML = gridPosts.map(cardTemplate).join("");
    }

    // re-trigger reveal for freshly injected nodes
    document.querySelectorAll(".reveal:not(.is-visible)").forEach(function (el) {
      el.classList.add("is-visible");
    });

    bindBookmarkButtons();
  }

  function bindBookmarkButtons() {
    document.querySelectorAll("[data-bookmark]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var slug = btn.getAttribute("data-bookmark");
        var nowBookmarked = toggleBookmark(slug);
        btn.classList.toggle("is-bookmarked", nowBookmarked);
        btn.setAttribute("aria-pressed", String(nowBookmarked));
        btn.innerHTML = bookmarkIconSvg(nowBookmarked);
        if (state.bookmarkOnly) render();
      });
    });
  }

  function buildCategoryChips() {
    var wrap = document.getElementById("journal-category-chips");
    state.categories.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.className = "jchip";
      btn.setAttribute("data-cat", cat);
      btn.textContent = cat;
      wrap.appendChild(btn);
    });
    wrap.addEventListener("click", function (e) {
      var btn = e.target.closest(".jchip");
      if (!btn) return;
      wrap.querySelectorAll(".jchip").forEach(function (b) {
        b.classList.remove("is-active");
      });
      btn.classList.add("is-active");
      state.activeCategory = btn.getAttribute("data-cat");
      render();
    });
  }

  function init() {
    fetch(INDEX_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("index fetch failed");
        return r.json();
      })
      .then(function (data) {
        state.posts = data.posts || [];
        state.categories = data.categories || [];
        buildCategoryChips();
        render();
      })
      .catch(function () {
        document.getElementById("journal-grid").innerHTML = "";
        var empty = document.getElementById("journal-empty");
        empty.style.display = "block";
        empty.querySelector("p").textContent = "بارگذاری ژورنال با خطا مواجه شد.";
      });

    var searchInput = document.getElementById("journal-search-input");
    var searchTimer;
    searchInput.addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.query = searchInput.value.trim();
        render();
      }, 180);
    });

    var bookmarkFilter = document.getElementById("journal-bookmark-filter");
    bookmarkFilter.addEventListener("click", function () {
      state.bookmarkOnly = !state.bookmarkOnly;
      bookmarkFilter.classList.toggle("is-active", state.bookmarkOnly);
      bookmarkFilter.setAttribute("aria-pressed", String(state.bookmarkOnly));
      render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
