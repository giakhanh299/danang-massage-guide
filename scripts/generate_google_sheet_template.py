from __future__ import annotations

import csv
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "runtime" / "google_sheet_templates"

TEMPLATES = {
    "customers": (
        ["userId", "channel", "userName", "areaPreference", "language", "notes", "firstSeenAt", "lastSeenAt"],
        [["12345", "telegram", "Alex", "My Khe", "en", "Prefers evening booking", "2026-05-29T00:00:00Z", "2026-05-29T00:00:00Z"]],
    ),
    "conversations": (
        ["timestamp", "channel", "userId", "role", "text"],
        [["2026-05-29T00:00:00Z", "telegram", "12345", "user", "Need massage tonight"]],
    ),
    "leads": (
        ["timestamp", "channel", "userId", "userName", "message", "detectedIntent", "page", "status"],
        [["2026-05-29T00:00:00Z", "telegram", "12345", "Alex", "Need massage tonight", "booking", "telegram/webhook", "new"]],
    ),
    "booking_requests": (
        ["timestamp", "channel", "userId", "userName", "message", "requestedService", "requestedArea", "requestedTime", "notes", "status"],
        [["2026-05-29T00:00:00Z", "telegram", "12345", "Alex", "Need massage tonight", "massage", "My Khe", "8 PM", "Confirm availability", "new"]],
    ),
    "faq": (
        ["question", "answer", "category", "sortOrder"],
        [["Which area is best for massage in Da Nang?", "My Khe Beach and An Thuong are popular for beach stays, while Han River and Hai Chau work well for city plans.", "massage", "1"]],
    ),
    "venues": (
        ["category", "name", "area", "address", "rating", "reviewCount", "website", "phone", "description"],
        [["massage_spa", "Levenin Spa Da Nang", "My Khe / Son Tra", "231 D. Dinh Nghe, Da Nang", "4.9", "3010", "https://leveninspadanang.com/", "+84 794 510 520", "Calm beach-side spa with bamboo massage and aroma oil therapy."]],
    ),
    "prompt_rules": (
        ["key", "value", "enabled"],
        [["reply_style", "Keep replies short and tourist-friendly.", "TRUE"]],
    ),
}


def write_template(tab_name: str, headers: list[str], rows: list[list[str]]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / f"{tab_name}.csv"
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(headers)
        for row in rows:
            writer.writerow(row)


def main() -> None:
    for tab_name, (headers, rows) in TEMPLATES.items():
        write_template(tab_name, headers, rows)
    print(f"Generated CSV templates in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
