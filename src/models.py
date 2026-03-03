"""Data models for App Store reviews."""

from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional


@dataclass
class Review:
    """Represents a single App Store review."""

    app_id: str
    app_name: str
    review_id: str
    rating: int
    title: str
    text: str
    author: str
    date: datetime
    helpful_count: int
    app_version: str

    def to_dict(self) -> dict:
        """Convert review to dictionary for serialization."""
        data = asdict(self)
        data['date'] = self.date.isoformat() if self.date else None
        return data

    @classmethod
    def from_dict(cls, data: dict) -> 'Review':
        """Create Review from dictionary."""
        if isinstance(data.get('date'), str):
            data['date'] = datetime.fromisoformat(data['date'])
        return cls(**data)


@dataclass
class ScrapeProgress:
    """Tracks scraping progress for resume capability."""

    app_id: str
    status: str  # 'pending', 'in_progress', 'completed', 'failed'
    review_count: int
    timestamp: datetime
    error: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert progress to dictionary for serialization."""
        return {
            'app_id': self.app_id,
            'status': self.status,
            'review_count': self.review_count,
            'timestamp': self.timestamp.isoformat(),
            'error': self.error
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'ScrapeProgress':
        """Create ScrapeProgress from dictionary."""
        if isinstance(data.get('timestamp'), str):
            data['timestamp'] = datetime.fromisoformat(data['timestamp'])
        return cls(**data)
