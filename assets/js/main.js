const WHATSAPP_LINK = "https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3";
const TELEGRAM_LINK = "https://t.me/danangmassagebooking";
const MESSENGER_LINK = "https://m.me/";
const GOOGLE_REVIEW_LINK = "https://www.google.com/maps/search/massage+da+nang";
const TRIPADVISOR_LINK = "https://www.tripadvisor.com/Search?q=massage%20da%20nang";

const LINKS = {
  whatsapp: WHATSAPP_LINK,
  telegram: TELEGRAM_LINK,
  messenger: MESSENGER_LINK,
  googleReview: GOOGLE_REVIEW_LINK,
  tripadvisor: TRIPADVISOR_LINK
};

const EXTERNAL_LINK_KEYS = new Set([
  "whatsapp",
  "telegram",
  "messenger",
  "googleReview",
  "tripadvisor"
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value));
}

function formatRating(value) {
  return Number(value).toFixed(1);
}

function applyConfiguredLinks(root = document) {
  root.querySelectorAll("[data-link-key]").forEach((element) => {
    const key = element.dataset.linkKey;
    const href = LINKS[key];

    if (!href) {
      return;
    }

    element.setAttribute("href", href);

    if (EXTERNAL_LINK_KEYS.has(key)) {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }
  });
}

function renderSpaCard(spa) {
  const services = Array.isArray(spa.topServices) ? spa.topServices : [];

  return `
    <article class="spotlight-card">
      <div class="photo-placeholder">
        <span>${escapeHtml(spa.imageLabel || "Future Spa Photo")}</span>
        <p>${escapeHtml(spa.imageDescription || spa.officialName)}</p>
      </div>
      <span class="spotlight-badge">${escapeHtml(spa.area || "Da Nang")}</span>
      <h3>${escapeHtml(spa.officialName)}</h3>
      <p class="spotlight-area">${escapeHtml(spa.address || "")}</p>
      <p class="spotlight-meta">${escapeHtml(spa.openingHours || "")} | Google rating ${escapeHtml(formatRating(spa.googleRating))} / 5 from ${formatCount(spa.reviewCount)} reviews</p>
      <p class="price-line"><strong>Price range:</strong> ${escapeHtml(spa.priceRange || "")}</p>
      <p>${escapeHtml(spa.description || "")}</p>
      ${services.length ? `<ul class="tag-list">${services.map((service) => `<li>${escapeHtml(service)}</li>`).join("")}</ul>` : ""}
      <div class="card-actions">
        <a class="button button-secondary button-small" href="${escapeHtml(spa.mapsUrl || "#")}" target="_blank" rel="noopener noreferrer">Google Maps</a>
        ${spa.website ? `<a class="button button-secondary button-small" href="${escapeHtml(spa.website)}" target="_blank" rel="noopener noreferrer">Website</a>` : ""}
        <a class="button button-small" data-link-key="whatsapp" href="#">Book via WhatsApp</a>
      </div>
    </article>
  `;
}

async function renderSpaGrids() {
  const spaGrids = document.querySelectorAll("[data-spa-grid]");

  if (!spaGrids.length) {
    return;
  }

  try {
    const response = await fetch("data/spas.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load spa data (${response.status})`);
    }

    const payload = await response.json();
    const spas = Array.isArray(payload) ? payload : payload.spas || [];

    spaGrids.forEach((grid) => {
      const limit = Number(grid.dataset.spaLimit || 0);
      const items = limit > 0 ? spas.slice(0, limit) : spas;
      grid.innerHTML = items.map(renderSpaCard).join("");
      applyConfiguredLinks(grid);
    });
  } catch (error) {
    spaGrids.forEach((grid) => {
      grid.innerHTML = `<p class="fine-print">Spa data could not be loaded right now. Please refresh the page or try again later.</p>`;
    });
  }
}

applyConfiguredLinks();
renderSpaGrids();

document.querySelectorAll("[data-current-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});

const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

const currentPage = window.location.pathname.split("/").pop() || "index.html";

document.querySelectorAll(".site-nav a[href]").forEach((link) => {
  const href = link.getAttribute("href");

  if (href === currentPage || (currentPage === "" && href === "index.html")) {
    link.classList.add("is-active");
  }
});

const bookingForm = document.getElementById("booking-form");
const bookingMessage = document.getElementById("booking-message");
const copyBookingMessageButton = document.getElementById("copy-booking-message");

if (bookingForm && bookingMessage) {
  const buildBookingMessage = () => {
    const formData = new FormData(bookingForm);
    const name = (formData.get("name") || "Guest").toString().trim() || "Guest";
    const platform = (formData.get("platform") || "WhatsApp").toString();
    const service = (formData.get("service") || "Relaxing Body Massage").toString();
    const date = (formData.get("date") || "Flexible").toString() || "Flexible";
    const time = (formData.get("time") || "Flexible").toString() || "Flexible";
    const guests = (formData.get("guests") || "1").toString();
    const area = (formData.get("area") || "Flexible").toString();
    const notes = (formData.get("notes") || "No extra notes").toString().trim() || "No extra notes";

    return [
      `Hello, my name is ${name}.`,
      `I would like to book a ${service} in Da Nang.`,
      `Preferred date: ${date}`,
      `Preferred time: ${time}`,
      `Travelers: ${guests}`,
      `Preferred area: ${area}`,
      `Reply on: ${platform}`,
      `Notes: ${notes}`,
      "Please confirm availability and total price. Thank you."
    ].join("\n");
  };

  const updateBookingPreview = () => {
    bookingMessage.textContent = buildBookingMessage();
  };

  bookingForm.addEventListener("input", updateBookingPreview);

  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updateBookingPreview();
    document.getElementById("booking-summary")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  });

  updateBookingPreview();
}

if (copyBookingMessageButton && bookingMessage) {
  copyBookingMessageButton.addEventListener("click", async () => {
    const originalLabel = copyBookingMessageButton.textContent;

    try {
      await navigator.clipboard.writeText(bookingMessage.textContent);
      copyBookingMessageButton.textContent = "Copied";
      window.setTimeout(() => {
        copyBookingMessageButton.textContent = originalLabel;
      }, 1600);
    } catch (error) {
      copyBookingMessageButton.textContent = "Copy failed";
      window.setTimeout(() => {
        copyBookingMessageButton.textContent = originalLabel;
      }, 1600);
    }
  });
}
