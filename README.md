# Google Maps Lead Generation CLI

A high-performance command-line lead generation application built with **Node.js** and **TypeScript** that leverages the **Google Places API (New)** to discover, enrich, deduplicate, and export business leads into professionally styled **Excel (.xlsx)** and **CSV (.csv)** files.

---

## 📌 Features

- **Terminal-Only Interactive Workflow:** Intuitive prompts powered by `@inquirer/prompts`, `chalk`, `boxen`, and `cli-table3`.
- **Google Places API (New) Integration:**
  - Modern Text Search & Geocoding via `places:searchText`.
  - Dynamic `X-Goog-FieldMask` construction to request only selected fields, reducing API costs.
  - Automatic pagination handling (`nextPageToken`).
- **3-Tier Priority Deduplication:**
  1. Google Place ID
  2. Normalized Phone Number (digits only, matching national & international variations)
  3. Normalized Business Name + Address
- **Lead Quality Filters:**
  - Minimum Google star rating (e.g. 4.0+).
  - Minimum user review count (e.g. 10+ reviews).
  - Must have public phone number.
  - Must have official website.
  - Operational businesses only (exclude closed/temporary closures).
- **Multi-Location & Multi-Category Support:**
  - Batch search multiple locations (e.g. Janakpuri, Dwarka, Rohini) or multiple categories in one session.
  - Generates individual files per location and a combined master file.
- **Professional Excel (.xlsx) Generation (ExcelJS):**
  - Google-branded header formatting with bold typography.
  - Clickable website and Google Maps hyperlinks.
  - Column auto-filtering and frozen header rows.
  - Safe phone number formatting (preserves leading `+` and `0`).
  - Auto-adjusted column widths with padding.
  - Alternating zebra-striped rows.
- **Search History & Saved Presets:**
  - Search history recorded in `history/search_history.json`.
  - Save search criteria as reusable presets to rerun in seconds.
- **Graceful Interruption (Ctrl+C):**
  - Safely intercepts `SIGINT` to export and persist whatever leads were already collected.

---

## 📁 Project Structure

```text
google_maps_lead/
├── src/
│   ├── index.ts                      # CLI entrypoint & main loop
│   ├── cli/
│   │   ├── prompts.ts                # Interactive Inquirer prompts
│   │   ├── welcome.ts                # Banner & compliance notice
│   │   └── progress.ts               # Terminal progress bar & completion summary
│   ├── services/
│   │   ├── google-places.service.ts  # Places API (New) search & field-mask builder
│   │   ├── geocoding.service.ts      # Coordinate resolution & bias calculation
│   │   ├── lead-collector.service.ts # Search orchestrator & pagination
│   │   └── export.service.ts         # ExcelJS & CSV generation
│   ├── modules/
│   │   ├── deduplication/            # 3-tier priority deduplication service
│   │   ├── filters/                  # Quality filters (ratings, reviews, phone, website)
│   │   └── history/                  # Local history & preset storage
│   ├── utils/
│   │   ├── logger.ts                 # Pino logging with key redaction
│   │   ├── helpers.ts                # Normalizers, sanitizers & file safety
│   │   └── validators.ts             # Input validation
│   ├── types/
│   │   └── lead.types.ts             # Data models & interfaces
│   └── config/
│       └── env.ts                    # Zod environment validation
├── output/                           # Generated Excel and CSV files
├── history/                          # Search history and presets JSON
├── logs/                             # Application logs (app.log)
├── tests/
│   └── test-suite.ts                 # Comprehensive automated test suite
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js** v18.0.0 or higher (v20+ recommended)
- **Google Cloud API Key** with **Places API (New)** enabled:
  1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
  2. Create a project and link a billing account.
  3. In **APIs & Services > Library**, search for and enable **Places API (New)**.
  4. In **Credentials**, create an API key.

### 2. Installation

Clone or navigate to the repository directory and install dependencies:

```bash
npm install
```

### 3. API Key Configuration

You can configure your API key in two ways:

#### Option A: `.env` file (Recommended)

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and set your key:

```env
GOOGLE_MAPS_API_KEY=AIzaSyYourActualKeyHere...
```

#### Option B: Interactive Setup via CLI

Launch the application without a `.env` file, and the interactive setup will automatically ask for your API key, validate it against Google Places API, and save it to `.env`.

---

## 💻 Running the Application

### Development Mode

Run directly using `tsx`:

```bash
npm start
```

### Production Build

Compile TypeScript to JavaScript and run the CLI:

```bash
npm run build
npm run cli
```

Or run via the binary name after linking (`npm link`):

```bash
maps-lead
```

---

## 🧪 Running Automated Tests

Run the test suite verifying deduplication, quality filters, Excel export, and history storage:

```bash
npm test
```

---

## 📊 Excel Output Structure

The generated Excel files include the following structured columns:

| Column | Description | Formatting |
|---|---|---|
| **Business Name** | Name of the business | Text, Left-aligned |
| **Category** | Primary business category | Text, Left-aligned |
| **Phone Number** | Public phone number | Text string format (`@`) |
| **Full Address** | Complete street address | Text, Left-aligned |
| **City** | City / Locality | Text |
| **State** | State / Administrative Area | Text |
| **Pincode** | Postal / Zip code | Text |
| **Website** | Official business website | Clickable Hyperlink |
| **Google Maps URL** | Direct link to view on Google Maps | Clickable Hyperlink |
| **Google Rating** | Average star rating | Number (`0.0`), Centered |
| **Total Reviews** | Number of user reviews | Number (`#,##0`), Centered |
| **Business Status** | `OPERATIONAL`, etc. | Text, Centered |
| **Latitude** | Geographic coordinate | Number |
| **Longitude** | Geographic coordinate | Number |
| **Place ID** | Google Places unique identifier | Text (Safe for audit) |
| **Opening Hours** | Weekly operating schedule | Text (if selected) |

Files are saved into the `output/` directory with clear naming:
`output/leads_<location>_<category>_<timestamp>.xlsx`

Existing files are **never overwritten**—the application automatically appends numeric suffixes (`_1`, `_2`) if a collision occurs.

---

## 🛡️ Deduplication Strategy

To prevent duplicate records when searching across multiple categories or paginated results, the deduplicator applies the following strict priority:

1. **Place ID Check:** Matches Google's permanent identifier.
2. **Phone Number Normalization:** Strips international prefixes, dashes, spaces, and compares standardized 10-digit numbers.
3. **Normalized Name & Address:** Strips punctuation, trims spaces, converts to lowercase, and compares `${name}:::${address}`.

---

## ⚙️ Advanced Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | *(empty)* | Google Cloud API key |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |
| `DEFAULT_SEARCH_RADIUS` | `5000` | Search radius in meters (5 KM) |
| `MAX_RETRIES` | `3` | Maximum API retry attempts on temporary errors |
| `RETRY_DELAY_MS` | `1000` | Base exponential backoff delay in ms |
| `REQUEST_TIMEOUT_MS` | `15000` | Axios HTTP timeout in ms |

---

## 📜 Compliance Notice

This CLI adheres strictly to the **Google Maps Platform Terms of Service**:
- Uses official Google Places API (New) endpoints only.
- Does not scrape private or unauthorized user data.
- Does not attempt to harvest personal email addresses or unlisted phone numbers.
- Dynamic field-masking minimizes API request payloads and billing costs.
