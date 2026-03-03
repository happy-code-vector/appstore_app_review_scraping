#!/usr/bin/env python3
"""
App Store Review Scraper CLI

Scrape negative reviews (1-2 stars) from iOS App Store apps.
"""

import sys
import os
from pathlib import Path
from datetime import datetime

import click
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.table import Table
from rich import print as rprint

# Fix Windows encoding issues
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from src.scraper import AppStoreReviewScraper
from src.utils import (
    parse_app_ids,
    load_progress,
    save_progress,
    save_reviews_csv,
    save_reviews_json,
    get_output_filename
)


console = Console(force_terminal=True)


@click.command()
@click.argument(
    'input_file',
    type=click.Path(exists=True),
    default='app_ids.txt'
)
@click.option(
    '-o', '--output',
    type=click.Choice(['csv', 'json', 'both']),
    default='csv',
    help='Output format (default: csv)'
)
@click.option(
    '-d', '--output-dir',
    type=click.Path(),
    default='./output',
    help='Output directory (default: ./output)'
)
@click.option(
    '-l', '--limit',
    type=int,
    default=100,
    help='Max reviews per app (default: 100)'
)
@click.option(
    '--no-resume',
    is_flag=True,
    help='Start fresh, ignore cached progress'
)
@click.option(
    '--cache-dir',
    type=click.Path(),
    default='./cache',
    help='Cache directory for resume state (default: ./cache)'
)
def main(
    input_file: str,
    output: str,
    output_dir: str,
    limit: int,
    no_resume: bool,
    cache_dir: str
):
    """
    Scrape negative reviews from iOS App Store apps.

    INPUT_FILE: Text file containing app IDs (space, comma, or newline separated)
    """
    output_path = Path(output_dir)
    cache_path = Path(cache_dir)

    # Parse app IDs from input file
    console.print(f"\n[bold blue]Reading app IDs from {input_file}...[/bold blue]")
    app_ids = parse_app_ids(input_file)

    if not app_ids:
        console.print("[bold red]No valid app IDs found in input file![/bold red]")
        sys.exit(1)

    console.print(f"[green]Found {len(app_ids)} app ID(s)[/green]")

    # Load existing progress
    progress_data = {}
    if not no_resume:
        progress_data = load_progress(cache_path)
        completed = sum(1 for p in progress_data.values() if p.status == 'completed')
        if completed > 0:
            console.print(f"[yellow]Resuming: {completed} app(s) already completed[/yellow]")

    # Display app IDs table
    table = Table(title="Apps to Scrape")
    table.add_column("#", style="cyan", width=4)
    table.add_column("App ID", style="green")
    table.add_column("Status", style="yellow")

    for idx, app_id in enumerate(app_ids, 1):
        status = progress_data.get(app_id)
        status_str = status.status if status else "pending"
        table.add_row(str(idx), app_id, status_str)

    console.print(table)

    # Define progress callback
    def on_progress(app_id: str, current: int, total: int):
        pass  # Progress handled by rich progress bar

    # Initialize scraper
    scraper = AppStoreReviewScraper(
        cache_dir=cache_path,
        progress_callback=on_progress
    )

    # Scrape with progress bar
    console.print(f"\n[bold blue]Starting scrape (max {limit} reviews per app)...[/bold blue]\n")

    all_reviews = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console
    ) as progress_bar:
        task = progress_bar.add_task("Scraping apps...", total=len(app_ids))

        # We need to manually update progress since scraper handles the loop
        # Modify to track within the scraper callback
        original_callback = scraper.progress_callback

        def progress_with_bar(app_id: str, current: int, total: int):
            progress_bar.update(task, completed=current, description=f"Scraping {app_id}...")
            if original_callback:
                original_callback(app_id, current, total)

        scraper.progress_callback = progress_with_bar

        all_reviews, final_progress = scraper.scrape_apps(
            app_ids=app_ids,
            existing_progress=progress_data,
            max_reviews=limit
        )

    # Summary
    console.print("\n[bold green]Scraping Complete![/bold green]")

    # Count stats
    completed_count = sum(1 for p in final_progress.values() if p.status == 'completed')
    failed_count = sum(1 for p in final_progress.values() if p.status == 'failed')
    total_reviews = len(all_reviews)

    summary_table = Table(title="Summary")
    summary_table.add_column("Metric", style="cyan")
    summary_table.add_column("Value", style="green")
    summary_table.add_row("Apps processed", str(completed_count))
    summary_table.add_row("Apps failed", str(failed_count))
    summary_table.add_row("Total reviews", str(total_reviews))

    console.print(summary_table)

    # Show failed apps if any
    if failed_count > 0:
        console.print("\n[bold red]Failed apps:[/bold red]")
        for app_id, p in final_progress.items():
            if p.status == 'failed':
                console.print(f"  - {app_id}: {p.error}")

    # Save output
    if all_reviews:
        timestamp = datetime.now()

        if output in ('csv', 'both'):
            csv_path = get_output_filename(output_path, 'csv', timestamp)
            save_reviews_csv(all_reviews, csv_path)
            console.print(f"\n[green]CSV saved to: {csv_path}[/green]")

        if output in ('json', 'both'):
            json_path = get_output_filename(output_path, 'json', timestamp)
            save_reviews_json(all_reviews, json_path)
            console.print(f"[green]JSON saved to: {json_path}[/green]")

        # Show sample reviews
        console.print(f"\n[bold]Sample reviews (first 3):[/bold]")
        for i, review in enumerate(all_reviews[:3], 1):
            console.print(f"\n[dim]--- Review {i} ---[/dim]")
            console.print(f"[bold]App:[/bold] {review.app_name} ({review.app_id})")
            console.print(f"[bold]Rating:[/bold] {'⭐' * review.rating} ({review.rating}/5)")
            console.print(f"[bold]Title:[/bold] {review.title}")
            console.print(f"[bold]Author:[/bold] {review.author}")
            text_preview = review.text[:200] + "..." if len(review.text) > 200 else review.text
            console.print(f"[bold]Review:[/bold] {text_preview}")
    else:
        console.print("\n[yellow]No reviews collected.[/yellow]")

    console.print("\n[bold blue]Done![/bold blue]")


if __name__ == '__main__':
    main()
