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

const SECONDARY_NAV_KEYS = new Set([
  "things-to-do-after-massage",
  "insider-guide",
  "contact"
]);

function normalizeNavHref(href) {
  return String(href || "")
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/\/+$/g, "")
    .replace(/^\/+/, "")
    .replace(/\.html$/i, "");
}

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

function formatReviewCount(value) {
  if (typeof value === "string") {
    return value;
  }

  return new Intl.NumberFormat("en-US").format(Number(value));
}

function buildMapsUrl(name, address) {
  const query = [name, address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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

function injectInsiderGuideFunnel(root = document) {
  const nav = root.querySelector(".site-nav");

  if (nav && !nav.querySelector('a[href="insider-guide.html"]')) {
    const insiderGuideLink = root.createElement("a");
    insiderGuideLink.setAttribute("href", "insider-guide.html");
    insiderGuideLink.textContent = "Insider Guide";
    nav.insertBefore(
      insiderGuideLink,
      nav.querySelector('a[href="contact.html"]') || nav.querySelector('[data-link-key="whatsapp"]') || null
    );
  }

  if (root.querySelector("#telegram-funnel-banner")) {
    return;
  }

  const footer = root.querySelector(".site-footer");

  if (!footer || !footer.parentNode) {
    return;
  }

  const banner = root.createElement("section");
  banner.id = "telegram-funnel-banner";
  banner.className = "section cta-band telegram-funnel-band";
  banner.innerHTML = `
    <div class="container cta-band-shell">
      <div>
        <p class="eyebrow">Need local tips in Da Nang?</p>
        <h2>Join our free Telegram group for massage, nightlife, seafood, and booking support.</h2>
      </div>
      <div class="cta-band-actions">
        <a class="button" data-link-key="telegram" href="#">Join Telegram</a>
      </div>
    </div>
  `;

  footer.parentNode.insertBefore(banner, footer);
}

function compactPrimaryNavigation(root = document) {
  const nav = root.querySelector(".site-nav");
  if (!nav) {
    return;
  }

  let moreDetails = nav.querySelector(".nav-more");
  if (!moreDetails) {
    moreDetails = root.createElement("details");
    moreDetails.className = "nav-more";
    moreDetails.innerHTML = `
      <summary class="nav-more-summary">More</summary>
      <div class="nav-more-panel" aria-label="Secondary navigation"></div>
    `;
  }

  const panel = moreDetails.querySelector(".nav-more-panel");
  const links = Array.from(nav.querySelectorAll("a[href]"));

  links.forEach((link) => {
    if (link.closest(".nav-more") || link.matches('[data-link-key="whatsapp"]')) {
      return;
    }

    const normalizedHref = normalizeNavHref(link.getAttribute("href"));
    if (SECONDARY_NAV_KEYS.has(normalizedHref)) {
      panel.appendChild(link);
    }
  });

  if (!panel.childElementCount) {
    moreDetails.remove();
    return;
  }

  if (!nav.contains(moreDetails)) {
    const whatsappButton = nav.querySelector('[data-link-key="whatsapp"]');
    nav.insertBefore(moreDetails, whatsappButton || null);
  }

  const isMobile = window.matchMedia("(max-width: 859px)").matches;
  if (isMobile) {
    moreDetails.open = true;
  } else {
    moreDetails.open = false;
    if (!nav.contains(moreDetails)) {
      nav.insertBefore(moreDetails, nav.querySelector('[data-link-key="whatsapp"]') || null);
    }
  }
}

function renderSpaCard(spa) {
  const services = Array.isArray(spa.topServices) ? spa.topServices : [];
  const area = spa.area || "Da Nang";
  const rating = Number(spa.googleRating);
  const reviewCount = formatCount(spa.reviewCount);

  return `
    <article class="spotlight-card">
      <div class="photo-placeholder">
        <span>${escapeHtml(spa.imageLabel || "Future Spa Photo")}</span>
        <p>${escapeHtml(spa.imageDescription || spa.officialName)}</p>
      </div>
      <span class="spotlight-badge">${escapeHtml(area)}</span>
      <h3>${escapeHtml(spa.officialName)}</h3>
      <p class="spotlight-area"><strong>Area:</strong> ${escapeHtml(area)}</p>
      <p class="spotlight-subline">${escapeHtml(spa.address || "")}</p>
      <p class="rating-line"><strong>Rating:</strong> ${escapeHtml(formatRating(rating))} / 5 from ${reviewCount} reviews</p>
      <p class="spotlight-meta"><strong>Hours:</strong> ${escapeHtml(spa.openingHours || "Check before visiting")}</p>
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

function renderListingCard(item, kind) {
  const area = item.area || "Da Nang";
  const mapsUrl = item.mapsUrl || buildMapsUrl(item.name, item.address);
  const rating = typeof item.rating === "number" ? formatRating(item.rating) : item.rating || "";
  const reviewCount = formatReviewCount(item.reviews);
  const websiteUrl = item.website || "";

  if (kind === "spa") {
    return renderSpaCard(item);
  }

  return `
    <article class="spotlight-card">
      <span class="spotlight-badge">${escapeHtml(area)}</span>
      <h3>${escapeHtml(item.name || "")}</h3>
      <p class="spotlight-area"><strong>Area:</strong> ${escapeHtml(area)}</p>
      <p class="spotlight-subline">${escapeHtml(item.address || "")}</p>
      <p class="rating-line"><strong>Rating:</strong> ${escapeHtml(rating)} / 5 from ${escapeHtml(reviewCount)} reviews</p>
      <p class="spotlight-meta"><strong>Type:</strong> ${escapeHtml(item.type || "")}</p>
      <p>${escapeHtml(item.description || "")}</p>
      <div class="card-actions">
        <a class="button button-secondary button-small" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer">Google Maps</a>
        ${websiteUrl ? `<a class="button button-secondary button-small" href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer">Website</a>` : ""}
      </div>
    </article>
  `;
}

async function renderDataDrivenGrids() {
  const listingGrids = document.querySelectorAll("[data-listing-grid]");

  if (!listingGrids.length) {
    return;
  }

  try {
    const sources = {
      spas: "data/spas.json",
      karaoke: "data/karaoke.json",
      barsclubs: "data/bars-clubs.json",
      seafoodbeer: "data/seafood-beer.json"
    };

    const cache = {};

    for (const grid of listingGrids) {
      const sourceKey = grid.dataset.listingSource || "spas";
      const sourceUrl = sources[sourceKey];
      const kind = grid.dataset.listingKind || (sourceKey === "spas" ? "spa" : "listing");

      if (!sourceUrl) {
        grid.innerHTML = `<p class="fine-print">Listing source is not configured.</p>`;
        continue;
      }

      if (!cache[sourceKey]) {
        const response = await fetch(sourceUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to load listing data from ${sourceUrl} (${response.status})`);
        }

        cache[sourceKey] = await response.json();
      }

      const payload = cache[sourceKey];
      const items = Array.isArray(payload) ? payload : payload.items || payload.spas || [];
      const limit = Number(grid.dataset.listingLimit || 0);
      const subset = limit > 0 ? items.slice(0, limit) : items;

      grid.innerHTML = subset.map((item) => renderListingCard(item, kind)).join("");
      applyConfiguredLinks(grid);
    }
  } catch (error) {
    listingGrids.forEach((grid) => {
      grid.innerHTML = `<p class="fine-print">Listing data could not be loaded right now. Please refresh the page or try again later.</p>`;
    });
  }
}

injectInsiderGuideFunnel();
compactPrimaryNavigation();
applyConfiguredLinks();
renderDataDrivenGrids();

document.querySelectorAll("[data-current-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});

const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const navBreakpoint = window.matchMedia("(max-width: 859px)");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    compactPrimaryNavigation();
  });
}

if (typeof navBreakpoint.addEventListener === "function") {
  navBreakpoint.addEventListener("change", compactPrimaryNavigation);
} else if (typeof navBreakpoint.addListener === "function") {
  navBreakpoint.addListener(compactPrimaryNavigation);
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
