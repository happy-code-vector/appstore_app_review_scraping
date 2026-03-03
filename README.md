# App Store Review Scraper

Scrape negative reviews (1-2 stars) from iOS App Store apps with resume capability.

## ⚠️ Important Note

**Apple has deprecated the iTunes RSS Customer Reviews API.** This means:

- The RSS feed (`itunes.apple.com/rss/customerreviews`) returns empty results for most apps
- The official App Store Connect API requires a developer account
- Third-party services (AppTweak, SensorTower, etc.) provide reliable review data via paid APIs

This tool attempts multiple methods to fetch reviews but may return limited results due to Apple's API restrictions.

## Features

- Scrape reviews from multiple apps using App Store IDs
- Filter for negative reviews only (1-2 stars by default)
- Resume interrupted scraping sessions
- Export to CSV, JSON, or both
- Progress tracking with rich UI
- Rate limiting to avoid blocking

## Installation

```bash
pip install -r requirements.txt
```

## Usage

### 1. Prepare your app IDs

Create a text file with App Store IDs (one per line, or separated by spaces/commas):

```
# app_ids.txt
389801252
284882215
333903271
```

> To find an app's ID: Open the App Store page and look for `idXXXXXXX` in the URL.

### 2. Run the scraper

```bash
python main.py app_ids.txt
```

### CLI Options

```
Usage: main.py [OPTIONS] INPUT_FILE

Arguments:
  INPUT_FILE  Text file with app IDs [default: app_ids.txt]

Options:
  -o, --output [csv|json|both]  Output format [default: csv]
  -d, --output-dir PATH         Output directory [default: ./output]
  -l, --limit INTEGER           Max reviews per app [default: 100]
  --no-resume                   Start fresh, ignore cached progress
  --cache-dir PATH              Cache directory [default: ./cache]
  --help                        Show this message
```

### Examples

```bash
# Basic usage (CSV output)
python main.py app_ids.txt

# JSON output
python main.py app_ids.txt --output json

# Both formats
python main.py app_ids.txt --output both

# Custom output directory
python main.py app_ids.txt --output-dir ./my_reviews

# Limit to 50 reviews per app
python main.py app_ids.txt --limit 50

# Start fresh (ignore previous progress)
python main.py app_ids.txt --no-resume
```

## Output

Reviews are saved to the `output/` directory with timestamped filenames:

- `reviews_20240315_143022.csv`
- `reviews_20240315_143022.json`

### CSV/JSON Fields

| Field | Description |
|-------|-------------|
| `app_id` | App Store ID |
| `app_name` | App name |
| `rating` | Star rating (1-2) |
| `title` | Review title |
| `text` | Full review text |
| `author` | Reviewer username |
| `date` | Review date |
| `helpful_count` | Helpful votes |
| `app_version` | App version reviewed |
| `review_id` | Unique review ID |

## Resume Capability

The scraper saves progress to `cache/progress.json`. If interrupted:

1. Run the same command again
2. Completed apps are skipped automatically
3. Scraping resumes from the last incomplete app

To start fresh:
```bash
python main.py app_ids.txt --no-resume
```

## Alternative Solutions

If you need reliable access to App Store reviews, consider these alternatives:

### 1. App Store Connect API (Official)
- Requires Apple Developer account
- Provides authenticated access to your apps' reviews
- Documentation: https://developer.apple.com/documentation/appstoreconnectapi

### 2. Third-Party APIs
- **AppTweak** - https://www.apptweak.io/
- **SensorTower** - https://sensortower.com/
- **App Annie / data.ai** - https://www.data.ai/

### 3. Manual Export
- Use App Store Connect to manually export reviews
- Available in the "Ratings and Reviews" section

## Rate Limiting

Built-in 2-second delay between requests to avoid rate limiting.

## Notes

- Only scrapes iOS App Store reviews
- Results may be limited due to Apple's API deprecation
- No authentication required for basic functionality
