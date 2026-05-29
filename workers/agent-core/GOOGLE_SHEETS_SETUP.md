# Google Sheets Setup

Create a spreadsheet with these tabs:

- `customers`
- `conversations`
- `leads`
- `booking_requests`
- `faq`
- `venues`
- `prompt_rules`

## Required columns

### `customers`
- `userId`
- `channel`
- `userName`
- `areaPreference`
- `language`
- `notes`
- `firstSeenAt`
- `lastSeenAt`

### `conversations`
- `timestamp`
- `channel`
- `userId`
- `role`
- `text`

### `leads`
- `timestamp`
- `channel`
- `userId`
- `userName`
- `message`
- `detectedIntent`
- `page`
- `status`

### `booking_requests`
- `timestamp`
- `channel`
- `userId`
- `userName`
- `message`
- `requestedService`
- `requestedArea`
- `requestedTime`
- `notes`
- `status`

### `faq`
- `question`
- `answer`
- `category`
- `sortOrder`

### `venues`
- `category`
- `name`
- `area`
- `address`
- `rating`
- `reviewCount`
- `website`
- `phone`
- `description`

### `prompt_rules`
- `key`
- `value`
- `enabled`

## Example rows

### `customers`
| userId | channel | userName | areaPreference | language | notes | firstSeenAt | lastSeenAt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 12345 | telegram | Alex | My Khe | en | Prefers evening booking | 2026-05-29T00:00:00Z | 2026-05-29T00:00:00Z |

### `conversations`
| timestamp | channel | userId | role | text |
| --- | --- | --- | --- | --- |
| 2026-05-29T00:00:00Z | telegram | 12345 | user | Need massage tonight |

### `leads`
| timestamp | channel | userId | userName | message | detectedIntent | page | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-29T00:00:00Z | telegram | 12345 | Alex | Need massage tonight | booking | telegram/webhook | new |

### `booking_requests`
| timestamp | channel | userId | userName | message | requestedService | requestedArea | requestedTime | notes | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-29T00:00:00Z | telegram | 12345 | Alex | Need massage tonight | massage | My Khe | 8 PM | Confirm availability | new |

### `faq`
| question | answer | category | sortOrder |
| --- | --- | --- | --- |
| Which area is best for massage in Da Nang? | My Khe Beach and An Thuong are popular for beach stays, while Han River and Hai Chau work well for city plans. | massage | 1 |

### `venues`
| category | name | area | address | rating | reviewCount | website | phone | description |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| massage_spa | Levenin Spa Da Nang | My Khe / Son Tra | 231 D. Dinh Nghe, Da Nang | 4.9 | 3010 | https://leveninspadanang.com/ | +84 794 510 520 | Calm beach-side spa with bamboo massage and aroma oil therapy. |

### `prompt_rules`
| key | value | enabled |
| --- | --- | --- | --- |
| reply_style | Keep replies short and tourist-friendly. | TRUE |
