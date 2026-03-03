"""App Store review scraper with browser automation.

Uses Selenium to scrape reviews from the App Store website.
"""

import time
import signal
import re
from datetime import datetime
from typing import List, Optional, Callable
from pathlib import Path

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException

from .models import Review, ScrapeProgress
from .utils import save_progress


class AppStoreReviewScraper:
    """Scraper for iOS App Store reviews with resume support."""

    # Rate limiting delay between requests (seconds)
    REQUEST_DELAY = 2.0

    # Maximum retries for failed requests
    MAX_RETRIES = 3

    # Page load timeout
    PAGE_TIMEOUT = 45

    def __init__(
        self,
        cache_dir: Path,
        progress_callback: Optional[Callable[[str, int, int], None]] = None,
        headless: bool = True
    ):
        """
        Initialize the scraper.
        """
        self.cache_dir = Path(cache_dir)
        self.progress_callback = progress_callback
        self.headless = headless
        self._shutdown_requested = False
        self._driver = None
        self._setup_signal_handlers()

    def _setup_signal_handlers(self):
        """Setup graceful shutdown on SIGINT/SIGTERM."""
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully."""
        print("\n\nShutdown requested. Saving progress...")
        self._shutdown_requested = True

    def _init_driver(self) -> bool:
        """Initialize the Selenium WebDriver."""
        if self._driver is not None:
            return True

        options = Options()

        if self.headless:
            options.add_argument('--headless')

        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-software-rasterizer')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_experimental_option('excludeSwitches', ['enable-automation'])
        options.add_experimental_option('useAutomationExtension', False)
        options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

        try:
            self._driver = webdriver.Chrome(options=options)
            self._driver.set_page_load_timeout(self.PAGE_TIMEOUT)
            return True
        except WebDriverException as e:
            print(f"Failed to initialize Chrome driver: {e}")
            return False

    def _close_driver(self):
        """Close the Selenium WebDriver."""
        if self._driver is not None:
            try:
                self._driver.quit()
            except Exception:
                pass
            self._driver = None

    def _get_app_info(self, app_id: str) -> dict:
        """Get app information from iTunes API."""
        url = f'https://itunes.apple.com/lookup?id={app_id}'

        for _ in range(self.MAX_RETRIES):
            try:
                response = requests.get(url, timeout=30)
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

        # Clean up the string
        date_str = date_str.strip()

        # Try common formats
        formats = [
            '%m/%d/%Y',
            '%Y-%m-%d',
            '%b %d, %Y',
            '%d %b %Y',
            '%Y-%m-%dT%H:%M:%S',
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        return datetime.now()

    def _scroll_page(self):
        """Scroll the page to load more content."""
        last_height = 0
        scroll_attempts = 0
        max_scroll_attempts = 5

        while scroll_attempts < max_scroll_attempts:
            # Scroll down
            self._driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)

            # Check new height
            new_height = self._driver.execute_script("return document.body.scrollHeight")

            if new_height == last_height:
                scroll_attempts += 1
            else:
                scroll_attempts = 0

            last_height = new_height

    def _extract_reviews_from_page(self, app_id: str, app_name: str, max_reviews: int, max_rating: int) -> List[Review]:
        """Extract reviews from the loaded page using multiple strategies."""
        reviews = []

        # Strategy 1: Look for article elements (common in App Store reviews)
        try:
            articles = self._driver.find_elements(By.TAG_NAME, 'article')
            for article in articles:
                if len(reviews) >= max_reviews:
                    break

                try:
                    review = self._extract_review_from_element(article, app_id, app_name, max_rating)
                    if review:
                        reviews.append(review)
                except Exception:
                    continue
        except Exception:
            pass

        # Strategy 2: Parse from page text (fallback)
        if not reviews:
            reviews = self._parse_reviews_from_text(app_id, app_name, max_reviews, max_rating)

        return reviews[:max_reviews]

    def _extract_review_from_element(self, element, app_id: str, app_name: str, max_rating: int) -> Optional[Review]:
        """Extract a single review from an article element."""
        try:
            # Get all text from the element
            text_content = element.text
            if not text_content or len(text_content) < 20:
                return None

            # Try to find rating
            rating = 0

            # Look for rating in aria-label
            try:
                # Find star rating elements
                star_elements = element.find_elements(By.CSS_SELECTOR, '[aria-label*="star"], [class*="star"]')
                for star_el in star_elements:
                    aria_label = star_el.get_attribute('aria-label') or ''
                    match = re.search(r'(\d)', aria_label)
                    if match:
                        rating = int(match.group(1))
                        break
            except Exception:
                pass

            # If no rating found, try from text patterns
            if rating == 0:
                # Check for rating patterns in text
                lines = text_content.split('\n')
                for line in lines[:3]:
                    match = re.search(r'^(\d)$', line.strip())
                    if match:
                        rating = int(match.group(1))
                        break

            # Skip if rating is above threshold
            if rating == 0 or rating > max_rating:
                return None

            # Split text into lines for parsing
            lines = [l.strip() for l in text_content.split('\n') if l.strip()]

            # Extract title (usually first or second line)
            title = ""
            text = ""
            author = ""
            date = datetime.now()

            # Look for date pattern (MM/DD/YYYY)
            date_pattern = r'^(\d{1,2}/\d{1,2}/\d{4})$'

            for i, line in enumerate(lines):
                # Check if this line is a date
                if re.match(date_pattern, line):
                    date = self._parse_date(line)
                    # Author is usually before date
                    if i > 0:
                        author = lines[i - 1]
                    # Title is usually after author
                    if i > 1:
                        title = lines[i - 2]
                    # Review text is after date
                    if i + 1 < len(lines):
                        text = '\n'.join(lines[i + 1:])
                    break

            # If no date found, try another approach
            if not text:
                # Assume first meaningful text block is the title
                # and subsequent text is the review
                if len(lines) >= 2:
                    title = lines[0][:100]  # Title is usually short
                    text = '\n'.join(lines[1:])
                elif len(lines) == 1:
                    text = lines[0]

            # Clean up
            title = title[:200] if title else ""
            text = text[:5000] if text else ""

            # Skip if no meaningful content
            if not text and not title:
                return None

            return Review(
                app_id=app_id,
                app_name=app_name,
                review_id="",
                rating=rating,
                title=title,
                text=text,
                author=author,
                date=date,
                helpful_count=0,
                app_version=""
            )

        except Exception:
            return None

    def _parse_reviews_from_text(self, app_id: str, app_name: str, max_reviews: int, max_rating: int) -> List[Review]:
        """Parse reviews from the page text as a fallback."""
        reviews = []

        try:
            body_text = self._driver.find_element(By.TAG_NAME, 'body').text

            # Split by common review separators
            # App Store reviews often have dates that can help identify review boundaries
            date_pattern = r'(\d{1,2}/\d{1,2}/\d{4})'

            # Find all dates as potential review markers
            dates = re.findall(date_pattern, body_text)

            # Split text by dates
            parts = re.split(date_pattern, body_text)

            current_date = datetime.now()
            current_author = ""
            current_title = ""
            current_text = ""
            current_rating = 0

            for i, part in enumerate(parts):
                part = part.strip()
                if not part:
                    continue

                # Check if this part is a date
                if re.match(date_pattern, part):
                    # Save previous review if exists and matches criteria
                    if current_rating > 0 and current_rating <= max_rating and (current_text or current_title):
                        reviews.append(Review(
                            app_id=app_id,
                            app_name=app_name,
                            review_id="",
                            rating=current_rating,
                            title=current_title[:200],
                            text=current_text[:5000],
                            author=current_author,
                            date=current_date,
                            helpful_count=0,
                            app_version=""
                        ))

                        if len(reviews) >= max_reviews:
                            break

                    # Reset for next review
                    current_date = self._parse_date(part)
                    current_author = ""
                    current_title = ""
                    current_text = ""
                    current_rating = 0

                    # Try to get author from previous part
                    if i > 0:
                        prev_lines = parts[i-1].strip().split('\n')
                        if prev_lines:
                            current_author = prev_lines[-1].strip()[:100]
                else:
                    # This is review content
                    lines = part.split('\n')
                    for line in lines:
                        line = line.strip()
                        if not line:
                            continue

                        # Check for rating (single digit)
                        if line.isdigit() and 1 <= int(line) <= 5:
                            current_rating = int(line)
                        elif not current_title and len(line) < 100:
                            current_title = line
                        else:
                            current_text += line + " "

            # Save last review
            if current_rating > 0 and current_rating <= max_rating and (current_text or current_title):
                if len(reviews) < max_reviews:
                    reviews.append(Review(
                        app_id=app_id,
                        app_name=app_name,
                        review_id="",
                        rating=current_rating,
                        title=current_title[:200],
                        text=current_text[:5000],
                        author=current_author,
                        date=current_date,
                        helpful_count=0,
                        app_version=""
                    ))

        except Exception as e:
            print(f"Error parsing reviews from text: {e}")

        return reviews

    def scrape_app(
        self,
        app_id: str,
        max_reviews: int = 100,
        max_rating: int = 2
    ) -> List[Review]:
        """
        Scrape reviews for a single app using browser automation.

        Args:
            app_id: The App Store app ID
            max_reviews: Maximum number of reviews to return
            max_rating: Maximum rating to include (1-5)

        Returns:
            List of Review objects
        """
        reviews = []

        # Get app info via API
        app_info = self._get_app_info(app_id)
        app_name = app_info.get('trackName', 'Unknown')

        if not self._init_driver():
            return reviews

        try:
            # Navigate to the app's reviews page
            url = f'https://apps.apple.com/us/app/id{app_id}?see-all=reviews'

            # Use explicit wait for page load
            self._driver.get(url)

            # Wait for page content to load
            WebDriverWait(self._driver, 15).until(
                EC.presence_of_element_located((By.TAG_NAME, 'article'))
            )

            # Additional wait for dynamic content
            time.sleep(3)

            # Scroll to load more reviews
            self._scroll_page()

            # Extract reviews
            reviews = self._extract_reviews_from_page(app_id, app_name, max_reviews, max_rating)

        except TimeoutException:
            print(f"Timeout loading page for app {app_id}")
        except Exception as e:
            print(f"Error scraping {app_id}: {e}")
        finally:
            # Keep driver alive for subsequent requests
            pass

        return reviews

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

        try:
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

        finally:
            self._close_driver()

        return all_reviews, progress
