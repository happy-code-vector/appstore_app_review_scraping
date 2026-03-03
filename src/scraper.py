"""App Store review scraper with resume capability.

Uses multiple methods to fetch reviews:
1. iTunes RSS API (may be deprecated for some apps)
2. Web scraping via requests
3. Can be extended with Selenium/Playwright when available
"""

import time
import signal
import re
import json
from datetime import datetime
from typing import List, Optional, Callable
from pathlib import Path

import requests

from .models import Review, ScrapeProgress
from .utils import save_progress


class AppStoreReviewScraper:
    """Scraper for iOS App Store reviews with resume support."""

    # Rate limiting delay between requests (seconds)
    REQUEST_DELAY = 2.0

    # Maximum retries for failed requests
    MAX_RETRIES = 3

    # Exponential backoff base
    BACKOFF_BASE = 2

    def __init__(
        self,
        cache_dir: Path,
        progress_callback: Optional[Callable[[str, int, int], None]] = None
    ):
        """
        Initialize the scraper.

        Args:
            cache_dir: Directory to store progress cache
            progress_callback: Optional callback for progress updates (app_id, current, total)
        """
        self.cache_dir = Path(cache_dir)
        self.progress_callback = progress_callback
        self._shutdown_requested = False
        self._session = requests.Session()
        self._session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/html, */*',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        self._setup_signal_handlers()

    def _setup_signal_handlers(self):
        """Setup graceful shutdown on SIGINT/SIGTERM."""
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully."""
        print("\n\nShutdown requested. Saving progress...")
        self._shutdown_requested = True

    def _fetch_with_retry(self, url: str, **kwargs) -> Optional[requests.Response]:
        """Fetch URL with retry logic."""
        retries = 0
        while retries < self.MAX_RETRIES:
            try:
                response = self._session.get(url, timeout=30, **kwargs)
                response.raise_for_status()
                return response
            except requests.RequestException:
                retries += 1
                if retries >= self.MAX_RETRIES:
                    return None
                wait_time = self.BACKOFF_BASE ** retries
                time.sleep(wait_time)
        return None

    def _get_app_info(self, app_id: str) -> dict:
        """Get app information from iTunes API."""
        url = f'https://itunes.apple.com/lookup?id={app_id}'
        response = self._fetch_with_retry(url)
        if response:
            data = response.json()
            if data.get('resultCount', 0) > 0:
                return data['results'][0]
        return {}

    def _parse_date(self, date_str: str) -> datetime:
        """Parse various date formats."""
        if not date_str:
            return datetime.now()

        # Try ISO format
        try:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except ValueError:
            pass

        # Try common formats
        formats = [
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%d %H:%M:%S',
            '%b %d, %Y',
            '%d %b %Y',
        ]
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        return datetime.now()

    def scrape_via_rss(self, app_id: str, app_name: str, max_reviews: int, max_rating: int) -> List[Review]:
        """Try to scrape reviews via iTunes RSS feed."""
        reviews = []

        # Try multiple country codes
        countries = ['us', 'gb', 'ca', 'au', 'de', 'fr']

        for country in countries:
            if len(reviews) >= max_reviews:
                break

            url = f"https://itunes.apple.com/{country}/rss/customerreviews/id{app_id}/sortBy=mostRecent/json"
            response = self._fetch_with_retry(url)

            if not response:
                continue

            try:
                data = response.json()
                entries = data.get("feed", {}).get("entry", [])

                # Skip first entry if it's app info
                if entries and "im:name" in entries[0]:
                    entries = entries[1:] if len(entries) > 1 else []

                for entry in entries:
                    if len(reviews) >= max_reviews:
                        break

                    try:
                        rating = int(entry.get("im:rating", {}).get("label", 0))
                        if rating <= max_rating:
                            review = Review(
                                app_id=app_id,
                                app_name=app_name,
                                review_id=entry.get("id", {}).get("label", ""),
                                rating=rating,
                                title=entry.get("title", {}).get("label", ""),
                                text=entry.get("content", {}).get("label", ""),
                                author=entry.get("author", {}).get("name", {}).get("label", ""),
                                date=self._parse_date(entry.get("updated", {}).get("label", "")),
                                helpful_count=int(entry.get("im:voteSum", {}).get("label", 0)),
                                app_version=entry.get("im:version", {}).get("label", "")
                            )
                            reviews.append(review)
                    except (KeyError, ValueError, TypeError):
                        continue

            except (json.JSONDecodeError, KeyError):
                continue

        return reviews

    def scrape_via_web(self, app_id: str, app_name: str, max_reviews: int, max_rating: int) -> List[Review]:
        """Try to scrape reviews from App Store web page."""
        reviews = []

        # The App Store page uses client-side rendering
        # Try to find embedded JSON data in the HTML
        url = f'https://apps.apple.com/us/app/id{app_id}?see-all=reviews'
        response = self._fetch_with_retry(url)

        if not response:
            return reviews

        html = response.text

        # Look for review data patterns in embedded JSON
        # Pattern 1: shoebox data
        pattern1 = r'"customerReviews"[^}]*"data"\s*:\s*(\[.*?\])\s*[,}]'
        matches = re.findall(pattern1, html, re.DOTALL)

        for match in matches:
            try:
                # Try to parse the JSON array
                review_data = json.loads(match)
                for r in review_data:
                    if len(reviews) >= max_reviews:
                        break

                    try:
                        attrs = r.get('attributes', {})
                        rating = attrs.get('rating', 5)

                        if rating <= max_rating:
                            review = Review(
                                app_id=app_id,
                                app_name=app_name,
                                review_id=r.get('id', ''),
                                rating=rating,
                                title=attrs.get('title', ''),
                                text=attrs.get('body', ''),
                                author=attrs.get('userName', ''),
                                date=self._parse_date(attrs.get('date', '')),
                                helpful_count=attrs.get('totalVotes', 0),
                                app_version=attrs.get('appVersionString', '')
                            )
                            reviews.append(review)
                    except (KeyError, ValueError, TypeError):
                        continue
            except json.JSONDecodeError:
                continue

        # Pattern 2: Look for review data in script tags
        pattern2 = r'"rating"\s*:\s*(\d)[^}]*"title"\s*:\s*"([^"]*)"[^}]*"body"\s*:\s*"([^"]*)"'
        matches2 = re.findall(pattern2, html, re.DOTALL)

        for match in matches2:
            if len(reviews) >= max_reviews:
                break

            try:
                rating = int(match[0])
                if rating <= max_rating:
                    review = Review(
                        app_id=app_id,
                        app_name=app_name,
                        review_id='',
                        rating=rating,
                        title=match[1].replace('\\n', '\n').replace('\\"', '"'),
                        text=match[2].replace('\\n', '\n').replace('\\"', '"'),
                        author='',
                        date=datetime.now(),
                        helpful_count=0,
                        app_version=''
                    )
                    reviews.append(review)
            except (ValueError, IndexError):
                continue

        return reviews

    def scrape_app(
        self,
        app_id: str,
        max_reviews: int = 100,
        max_rating: int = 2
    ) -> List[Review]:
        """
        Scrape reviews for a single app using multiple methods.

        Args:
            app_id: The App Store app ID
            max_reviews: Maximum number of reviews to return
            max_rating: Maximum rating to include (1-5), we want <= max_rating

        Returns:
            List of Review objects
        """
        # Get app info first
        app_info = self._get_app_info(app_id)
        app_name = app_info.get('trackName', 'Unknown')

        reviews = []

        # Try RSS API first (faster)
        reviews = self.scrape_via_rss(app_id, app_name, max_reviews, max_rating)

        # If RSS didn't work, try web scraping
        if not reviews:
            reviews = self.scrape_via_web(app_id, app_name, max_reviews, max_rating)

        return reviews[:max_reviews]

    def scrape_apps(
        self,
        app_ids: List[str],
        existing_progress: dict,
        max_reviews: int = 100
    ) -> tuple[List[Review], dict]:
        """
        Scrape reviews for multiple apps with progress tracking.

        Args:
            app_ids: List of App Store app IDs
            existing_progress: Existing progress from previous run
            max_reviews: Maximum reviews per app

        Returns:
            Tuple of (list of all reviews, updated progress dict)
        """
        all_reviews = []
        progress = dict(existing_progress)
        total_apps = len(app_ids)

        for idx, app_id in enumerate(app_ids):
            if self._shutdown_requested:
                break

            # Skip completed apps
            if app_id in progress and progress[app_id].status == 'completed':
                continue

            # Update progress callback
            if self.progress_callback:
                self.progress_callback(app_id, idx + 1, total_apps)

            # Mark as in progress
            progress[app_id] = ScrapeProgress(
                app_id=app_id,
                status='in_progress',
                review_count=0,
                timestamp=datetime.now()
            )
            save_progress(progress, self.cache_dir)

            try:
                # Scrape reviews
                reviews = self.scrape_app(app_id, max_reviews)
                all_reviews.extend(reviews)

                # Mark as completed
                progress[app_id] = ScrapeProgress(
                    app_id=app_id,
                    status='completed',
                    review_count=len(reviews),
                    timestamp=datetime.now()
                )

            except Exception as e:
                # Mark as failed
                progress[app_id] = ScrapeProgress(
                    app_id=app_id,
                    status='failed',
                    review_count=0,
                    timestamp=datetime.now(),
                    error=str(e)
                )

            # Save progress after each app
            save_progress(progress, self.cache_dir)

            # Rate limiting delay
            if idx < total_apps - 1 and not self._shutdown_requested:
                time.sleep(self.REQUEST_DELAY)

        return all_reviews, progress
