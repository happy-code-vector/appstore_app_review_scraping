"""App Store review scraper using Apple's RSS feed API.

Fetches reviews via the iTunes RSS customer reviews endpoint
instead of browser automation.
"""

import time
import signal
import re
from datetime import datetime
from typing import List, Optional, Callable
from pathlib import Path

import requests

from .models import Review, ScrapeProgress
from .utils import save_progress


class AppStoreReviewScraper:
    """Scraper for iOS App Store reviews with resume support."""

    REQUEST_DELAY = 2.0
    MAX_RETRIES = 3

    def __init__(
        self,
        cache_dir: Path,
        progress_callback: Optional[Callable[[str, int, int], None]] = None,
    ):
        self.cache_dir = Path(cache_dir)
        self.progress_callback = progress_callback
        self._shutdown_requested = False
        self._setup_signal_handlers()
        self._session = requests.Session()
        self._session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

    def _setup_signal_handlers(self):
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        print("\n\nShutdown requested. Saving progress...")
        self._shutdown_requested = True

    def _get_app_info(self, app_id: str) -> dict:
        """Get app information from iTunes API."""
        url = f'https://itunes.apple.com/lookup?id={app_id}'

        for _ in range(self.MAX_RETRIES):
            try:
                response = self._session.get(url, timeout=30)
                response.raise_for_status()
                data = response.json()
                if data.get('resultCount', 0) > 0:
                    return data['results'][0]
                return {}
            except requests.RequestException:
                time.sleep(1)

        return {}

    def _parse_date(self, date_str: str) -> datetime:
        """Parse various date formats."""
        if not date_str:
            return datetime.now()

        date_str = date_str.strip()

        formats = [
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%S%z',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%d',
            '%m/%d/%Y',
            '%b %d, %Y',
            '%d %b %Y',
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        return datetime.now()

    def scrape_app(
        self,
        app_id: str,
        max_reviews: int = 100,
        max_rating: int = 2
    ) -> List[Review]:
        """
        Scrape reviews for a single app via Apple's RSS feed API.

        Args:
            app_id: The App Store app ID
            max_reviews: Maximum number of reviews to return
            max_rating: Maximum rating to include (1-5)

        Returns:
            List of Review objects
        """
        reviews = []

        app_info = self._get_app_info(app_id)
        app_name = app_info.get('trackName', 'Unknown')

        url = f'https://itunes.apple.com/rss/customerreviews/id={app_id}/sortBy=mostRecent/json'

        try:
            response = self._session.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            print(f"Error fetching reviews for app {app_id}: {e}")
            return reviews

        entries = data.get('feed', {}).get('entry', [])
        if not entries:
            return reviews

        # First entry is app metadata, skip it
        for entry in entries:
            if len(reviews) >= max_reviews:
                break

            # Skip the app info entry (it has a 'im:name' field instead of 'title')
            if 'im:name' in entry:
                continue

            try:
                rating_label = entry.get('im:rating', {}).get('label', '0')
                rating = int(rating_label)
            except (ValueError, TypeError):
                continue

            if rating > max_rating:
                continue

            title = entry.get('title', {}).get('label', '')
            text = entry.get('content', {}).get('label', '')
            author = entry.get('author', {}).get('name', {}).get('label', '')
            review_id = entry.get('id', {}).get('label', '')

            date_str = entry.get('updated', {}).get('label', '')
            date = self._parse_date(date_str)

            helpful_count = 0
            vote_count = entry.get('im:voteCount', {}).get('label', '0')
            try:
                helpful_count = int(vote_count)
            except (ValueError, TypeError):
                pass

            app_version = entry.get('im:version', {}).get('label', '')

            if not text and not title:
                continue

            reviews.append(Review(
                app_id=app_id,
                app_name=app_name,
                review_id=review_id,
                rating=rating,
                title=title[:200],
                text=text[:5000],
                author=author,
                date=date,
                helpful_count=helpful_count,
                app_version=app_version
            ))

        return reviews

    def scrape_apps(
        self,
        app_ids: List[str],
        existing_progress: dict,
        max_reviews: int = 100
    ) -> tuple[List[Review], dict]:
        """
        Scrape reviews for multiple apps with progress tracking.
        """
        all_reviews = []
        progress = dict(existing_progress)
        total_apps = len(app_ids)

        try:
            for idx, app_id in enumerate(app_ids):
                if self._shutdown_requested:
                    break

                if app_id in progress and progress[app_id].status == 'completed':
                    continue

                if self.progress_callback:
                    self.progress_callback(app_id, idx + 1, total_apps)

                progress[app_id] = ScrapeProgress(
                    app_id=app_id,
                    status='in_progress',
                    review_count=0,
                    timestamp=datetime.now()
                )
                save_progress(progress, self.cache_dir)

                try:
                    reviews = self.scrape_app(app_id, max_reviews)
                    all_reviews.extend(reviews)

                    progress[app_id] = ScrapeProgress(
                        app_id=app_id,
                        status='completed',
                        review_count=len(reviews),
                        timestamp=datetime.now()
                    )

                except Exception as e:
                    progress[app_id] = ScrapeProgress(
                        app_id=app_id,
                        status='failed',
                        review_count=0,
                        timestamp=datetime.now(),
                        error=str(e)
                    )

                save_progress(progress, self.cache_dir)

                if idx < total_apps - 1 and not self._shutdown_requested:
                    time.sleep(self.REQUEST_DELAY)

        finally:
            self._session.close()

        return all_reviews, progress
