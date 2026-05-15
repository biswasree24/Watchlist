/* =========================================================
   MY WATCHLIST APP — script.js
   CRUD operations + Local Storage + Search/Filter + Theme
   Author: Student Portfolio Project
   ========================================================= */

"use strict";

/* ─────────────────────────────────────────────
   1. ELEMENT REFERENCES
   We cache all DOM elements we'll use frequently
   to avoid repetitive querySelector calls.
───────────────────────────────────────────── */
const titleInput      = document.getElementById("titleInput");
const categorySelect  = document.getElementById("categorySelect");
const statusSelect    = document.getElementById("statusSelect");
const ratingInput     = document.getElementById("ratingInput");
const titleError      = document.getElementById("titleError");
const ratingError     = document.getElementById("ratingError");
const submitBtn       = document.getElementById("submitBtn");
const cancelBtn       = document.getElementById("cancelBtn");
const formHeading     = document.getElementById("formHeading");
const searchInput     = document.getElementById("searchInput");
const listArea        = document.querySelector(".list-area");
const emptyState      = document.getElementById("emptyState");
const itemCountEl     = document.getElementById("itemCount");
const counterBadge    = document.getElementById("counterBadge");
const themeToggle     = document.getElementById("themeToggle");
const themeIcon       = document.getElementById("themeIcon");
const modalOverlay    = document.getElementById("modalOverlay");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn  = document.getElementById("cancelDeleteBtn");
const modalBody       = document.getElementById("modalBody");
const toast           = document.getElementById("toast");
const filterPills     = document.querySelectorAll(".pill");


/* ─────────────────────────────────────────────
   2. APP STATE
   These variables hold the current state of
   the application in memory.
───────────────────────────────────────────── */
let items          = [];       // Array of watchlist objects
let editingId      = null;     // ID of the item currently being edited (null = adding)
let pendingDelete  = null;     // ID of the item pending deletion confirmation
let activeFilter   = "All";    // Current category filter pill
let toastTimer     = null;     // Timer reference for auto-hiding toast


/* ─────────────────────────────────────────────
   3. LOCAL STORAGE HELPERS
   Persist and retrieve the watchlist from
   the browser's Local Storage so data survives
   page refreshes.
───────────────────────────────────────────── */

/** Save the items array to Local Storage as JSON */
function saveToStorage() {
  localStorage.setItem("watchlistItems", JSON.stringify(items));
}

/** Load the items array from Local Storage (or return []) */
function loadFromStorage() {
  const raw = localStorage.getItem("watchlistItems");
  return raw ? JSON.parse(raw) : [];
}


/* ─────────────────────────────────────────────
   4. UNIQUE ID GENERATOR
   Creates a simple unique string ID using the
   current timestamp + random number.
───────────────────────────────────────────── */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}


/* ─────────────────────────────────────────────
   5. THEME TOGGLE (Dark / Light Mode)
───────────────────────────────────────────── */

/** Apply a theme ("dark" | "light") to the <html> element */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeIcon.textContent = theme === "dark" ? "🌙" : "☀️";
  localStorage.setItem("watchlistTheme", theme);
}

/** Read the saved theme preference (default: dark) */
function loadTheme() {
  const saved = localStorage.getItem("watchlistTheme") || "dark";
  applyTheme(saved);
}

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});


/* ─────────────────────────────────────────────
   6. FORM VALIDATION
   Returns true if the form inputs are valid,
   and shows inline error messages if not.
───────────────────────────────────────────── */
function validateForm() {
  let valid = true;

  // ── Title: must not be empty or whitespace
  if (!titleInput.value.trim()) {
    titleError.textContent = "Title cannot be empty.";
    titleInput.focus();
    valid = false;
  } else {
    titleError.textContent = "";
  }

  // ── Rating: optional, but if provided must be 1–10
  const ratingVal = ratingInput.value.trim();
  if (ratingVal !== "") {
    const num = Number(ratingVal);
    if (isNaN(num) || num < 1 || num > 10) {
      ratingError.textContent = "Rating must be between 1 and 10.";
      valid = false;
    } else {
      ratingError.textContent = "";
    }
  } else {
    ratingError.textContent = "";
  }

  return valid;
}


/* ─────────────────────────────────────────────
   7. RENDER FUNCTIONS
   Build and display the watchlist cards from
   the items array, respecting the active
   search query and category filter.
───────────────────────────────────────────── */

/**
 * Convert a status string to a CSS class suffix for the badge.
 * "Plan to Watch" → "plan", "Watching" → "watching", etc.
 */
function statusClass(status) {
  return {
    "Plan to Watch": "plan",
    "Watching":      "watching",
    "Completed":     "completed",
    "Dropped":       "dropped"
  }[status] || "plan";
}

/**
 * Build star characters for a numeric rating.
 * e.g. rating=8 → "★★★★★★★★☆☆ 8/10"
 */
function renderStars(rating) {
  if (!rating) return "";
  const filled = Math.round(rating);
  const empty  = 10 - filled;
  return "★".repeat(filled) + "☆".repeat(empty) + ` ${rating}/10`;
}

/** Category emoji map */
function categoryEmoji(cat) {
  return { Movie: "🎬", Anime: "⛩️", Series: "📺", Documentary: "🎥" }[cat] || "📽️";
}

/**
 * Main render loop — builds cards from the filtered items
 * and injects them into .list-area.
 */
function renderList() {
  const query   = searchInput.value.trim().toLowerCase();
  const filter  = activeFilter;

  // Filter: category + search query
  const filtered = items.filter(item => {
    const matchCat    = filter === "All" || item.category === filter;
    const matchSearch = item.title.toLowerCase().includes(query);
    return matchCat && matchSearch;
  });

  // Update counter badge
  itemCountEl.textContent = items.length;

  // Animate counter badge on every change
  counterBadge.classList.remove("bump");
  void counterBadge.offsetWidth; // force reflow to restart animation
  counterBadge.classList.add("bump");
  setTimeout(() => counterBadge.classList.remove("bump"), 400);

  // Toggle empty state visibility
  emptyState.classList.toggle("visible", filtered.length === 0);

  // Remove old item cards (but keep emptyState in the DOM)
  listArea.querySelectorAll(".item-card").forEach(el => el.remove());

  // Build a card for each filtered item
  filtered.forEach((item, i) => {
    const card = document.createElement("article");
    card.className  = "item-card";
    card.dataset.id = item.id;
    card.style.animationDelay = `${i * 0.06}s`; // stagger animation

    card.innerHTML = `
      <div class="card-info">
        <p class="card-title">${escapeHtml(item.title)}</p>
        <div class="card-meta">
          <span class="tag">${categoryEmoji(item.category)} ${item.category}</span>
          <span class="status-badge ${statusClass(item.status)}">${item.status}</span>
          ${item.rating ? `<span class="card-rating">${renderStars(item.rating)}</span>` : ""}
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-icon edit-btn"   aria-label="Edit ${escapeHtml(item.title)}"   title="Edit">✎</button>
        <button class="btn-icon delete-btn" aria-label="Delete ${escapeHtml(item.title)}" title="Delete">✕</button>
      </div>
    `;

    // Wire up edit and delete buttons on this card
    card.querySelector(".edit-btn").addEventListener("click",   () => startEdit(item.id));
    card.querySelector(".delete-btn").addEventListener("click", () => openDeleteModal(item.id));

    listArea.appendChild(card);
  });
}

/**
 * Escape HTML special chars to prevent XSS when injecting
 * user-provided content as innerHTML.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


/* ─────────────────────────────────────────────
   8. ADD ITEM
───────────────────────────────────────────── */

/** Handle the form submit button (Add or Save edit) */
submitBtn.addEventListener("click", () => {
  if (!validateForm()) return;

  if (editingId) {
    // ── UPDATE existing item
    const idx = items.findIndex(it => it.id === editingId);
    if (idx !== -1) {
      items[idx] = {
        ...items[idx],
        title:    titleInput.value.trim(),
        category: categorySelect.value,
        status:   statusSelect.value,
        rating:   ratingInput.value ? Number(ratingInput.value) : null,
      };
    }
    showToast("✔ Changes saved!");
    cancelEdit();
  } else {
    // ── ADD new item
    const newItem = {
      id:       generateId(),
      title:    titleInput.value.trim(),
      category: categorySelect.value,
      status:   statusSelect.value,
      rating:   ratingInput.value ? Number(ratingInput.value) : null,
    };
    items.unshift(newItem); // add to top of list
    showToast("✦ Added to your watchlist!");
    clearForm();
  }

  saveToStorage();
  renderList();
});


/* ─────────────────────────────────────────────
   9. EDIT ITEM
   Populate the form with existing item data,
   scroll to the form, and put it in edit mode.
───────────────────────────────────────────── */
function startEdit(id) {
  const item = items.find(it => it.id === id);
  if (!item) return;

  editingId = id;

  // Pre-fill form inputs with the item's current values
  titleInput.value        = item.title;
  categorySelect.value    = item.category;
  statusSelect.value      = item.status;
  ratingInput.value       = item.rating || "";

  // Update UI to show we're in edit mode
  formHeading.textContent            = "Edit Title";
  submitBtn.querySelector(".btn-text").textContent = "✦ Save Changes";
  cancelBtn.style.display            = "inline-flex";

  // Scroll to form smoothly
  document.querySelector(".form-card").scrollIntoView({ behavior: "smooth", block: "center" });
  titleInput.focus();
}

/** Cancel edit and reset form to "add" mode */
function cancelEdit() {
  editingId = null;
  formHeading.textContent = "Add New Title";
  submitBtn.querySelector(".btn-text").textContent = "✦ Add to Watchlist";
  cancelBtn.style.display = "none";
  clearForm();
}

cancelBtn.addEventListener("click", cancelEdit);


/* ─────────────────────────────────────────────
   10. DELETE ITEM (with confirmation modal)
───────────────────────────────────────────── */

/** Show the delete confirmation modal for a given item */
function openDeleteModal(id) {
  const item = items.find(it => it.id === id);
  if (!item) return;

  pendingDelete = id;
  modalBody.textContent = `"${item.title}" will be removed permanently.`;
  modalOverlay.hidden   = false;
  confirmDeleteBtn.focus();
}

/** Perform the actual deletion after confirmation */
confirmDeleteBtn.addEventListener("click", () => {
  if (!pendingDelete) return;

  items = items.filter(it => it.id !== pendingDelete);
  pendingDelete = null;
  saveToStorage();
  renderList();
  closeModal();
  showToast("🗑 Title removed.");
});

/** Close the modal without deleting */
cancelDeleteBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", e => {
  if (e.target === modalOverlay) closeModal();
});

function closeModal() {
  modalOverlay.hidden = true;
  pendingDelete = null;
}

/** Close modal on Escape key press */
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !modalOverlay.hidden) closeModal();
});


/* ─────────────────────────────────────────────
   11. SEARCH & FILTER
───────────────────────────────────────────── */

// Re-render list as user types in the search box
searchInput.addEventListener("input", renderList);

// Filter pills: click to set activeFilter and re-render
filterPills.forEach(pill => {
  pill.addEventListener("click", () => {
    filterPills.forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    activeFilter = pill.dataset.filter;
    renderList();
  });
});


/* ─────────────────────────────────────────────
   12. UTILITY: Clear Form Inputs
───────────────────────────────────────────── */
function clearForm() {
  titleInput.value     = "";
  categorySelect.value = "Movie";
  statusSelect.value   = "Plan to Watch";
  ratingInput.value    = "";
  titleError.textContent  = "";
  ratingError.textContent = "";
}


/* ─────────────────────────────────────────────
   13. TOAST NOTIFICATION
   Shows a brief message at the bottom of
   the screen, then auto-hides after 2.5s.
───────────────────────────────────────────── */
function showToast(message) {
  if (toastTimer) clearTimeout(toastTimer);

  toast.textContent = message;
  toast.classList.add("visible");

  toastTimer = setTimeout(() => {
    toast.classList.remove("visible");
  }, 2500);
}


/* ─────────────────────────────────────────────
   14. INIT
   Run on page load: restore theme, load items
   from Local Storage, and render the list.
───────────────────────────────────────────── */
function init() {
  loadTheme();
  items = loadFromStorage();
  renderList();
}

init();
