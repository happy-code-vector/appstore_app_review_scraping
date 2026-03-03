"""Utility functions for file parsing and output handling."""

import json
import re
from pathlib import Path
from typing import List, Optional
from datetime import datetime

import pandas as pd

from .models import Review, ScrapeProgress


def parse_app_ids(file_path: str) -> List[str]:
    """
    Parse app IDs from a text file.
    Supports space, comma, and newline separators.
    Handles formats: "id1524421486" or "1524421486"
    """
    content = Path(file_path).read_text(encoding='utf-8')

    # Remove comments (lines starting with #)
    lines = content.split('\n')
    clean_lines = [line.split('#')[0].strip() for line in lines]
    clean_content = ' '.join(clean_lines)

    # Split by common separators
    # Replace commas with spaces, then split by whitespace
    clean_content = clean_content.replace(',', ' ')
    raw_ids = clean_content.split()

    valid_ids = []
    for raw_id in raw_ids:
        raw_id = raw_id.strip()
        if not raw_id:
            continue

        # Handle "id123456" format - strip "id" prefix
        if raw_id.lower().startswith('id'):
            numeric_part = raw_id[2:]
            if numeric_part.isdigit():
                valid_ids.append(numeric_part)
        # Handle plain numeric format
        elif raw_id.isdigit():
            valid_ids.append(raw_id)

    return valid_ids


def save_reviews_csv(reviews: List[Review], output_path: Path) -> None:
    """Save reviews to CSV file."""
    if not reviews:
        return

    data = [review.to_dict() for review in reviews]
    df = pd.DataFrame(data)

    # Reorder columns for better readability
    columns = [
        'app_id', 'app_name', 'rating', 'title', 'text',
        'author', 'date', 'helpful_count', 'app_version', 'review_id'
    ]
    df = df[columns]

    df.to_csv(output_path, index=False, encoding='utf-8')


def save_reviews_json(reviews: List[Review], output_path: Path) -> None:
    """Save reviews to JSON file, grouped by app_id."""
    if not reviews:
        return

    # Group reviews by app_id
    apps_dict = {}
    for review in reviews:
        if review.app_id not in apps_dict:
            apps_dict[review.app_id] = {
                'app_id': review.app_id,
                'app_name': review.app_name,
                'reviews': []
            }

        # Create review item without app_id and app_name (they're in parent)
        review_item = {
            'rating': review.rating,
            'title': review.title,
            'text': review.text,
            'author': review.author,
            'date': review.date.isoformat() if review.date else None,
            'helpful_count': review.helpful_count,
            'app_version': review.app_version,
            'review_id': review.review_id
        }
        apps_dict[review.app_id]['reviews'].append(review_item)

    # Convert to list
    data = list(apps_dict.values())

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_progress(cache_dir: Path) -> dict:
    """Load scraping progress from cache."""
    progress_file = cache_dir / 'progress.json'

    if not progress_file.exists():
        return {}

    with open(progress_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    return {k: ScrapeProgress.from_dict(v) for k, v in data.items()}


def save_progress(progress: dict, cache_dir: Path) -> None:
    """Save scraping progress to cache."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    progress_file = cache_dir / 'progress.json'

    data = {k: v.to_dict() for k, v in progress.items()}

    with open(progress_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)


def get_output_filename(output_dir: Path, format_type: str, timestamp: datetime) -> Path:
    """Generate output filename with timestamp."""
    output_dir.mkdir(parents=True, exist_ok=True)
    date_str = timestamp.strftime('%Y%m%d_%H%M%S')

    if format_type == 'csv':
        return output_dir / f'reviews_{date_str}.csv'
    elif format_type == 'json':
        return output_dir / f'reviews_{date_str}.json'
    else:
        raise ValueError(f"Unknown format type: {format_type}")
