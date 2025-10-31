# Sentio - Amazon Product Review Analysis

Sentio analyzes customer reviews for Amazon product pages and provides sentiment, aspect summaries, and a buy/avoid recommendation. This deployment and the frontend are intentionally limited to Amazon product pages only.

Important: This project currently supports Amazon product pages (amazon.com, amazon.in, and other amazon.* domains) only. Submitting URLs from other marketplaces (Flipkart, Meesho, etc.) will return an error.

## Features

- Fetches and analyzes reviews from Amazon product pages.
- Sentiment analysis (positive / neutral / negative) per review.
- Aggregated summary: overall sentiment breakdown, average score, top aspects.
- Recommendation: BUY / AVOID / CONSIDER / NEUTRAL with explanation.
- Export reviews and analysis to CSV.

## Tech Stack

- Frontend: React + TypeScript
- Backend: FastAPI (Python)
- Optional: Playwright (for JS-rendered pages) — not required for Amazon pages in this deployment

## Getting Started

### Prerequisites

- Python 3.7+
- Node.js and npm

### Install

1. Clone repository
   ```
   git clone https://github.com/yourusername/sentio.git
   cd sentio
   ```

2. Backend
   ```
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. Frontend
   ```
   cd ../frontend
   npm install
   ```

### Run (development)

- Start backend:
  ```
  cd backend
  source .venv/bin/activate
  uvicorn app.main:app --reload --port 8000
  ```
- Start frontend:
  ```
  cd ../frontend
  npm run dev
  ```
- Open: http://localhost:3000

## Usage

- Paste an Amazon product page URL (amazon.com, amazon.in, etc.) into the input and click Analyze.
- View recommendations, sentiment charts, and top aspects.
- Use filters to show Positive / Neutral / Negative reviews and export results as CSV.

## Notes & Limitations

- Amazon-only: The UI and client explicitly validate Amazon hosts and will reject non-Amazon URLs.
- JS-heavy pages on other marketplaces are not supported in this deployment. To support more sites reliably, the backend must run a Playwright-capable environment and include site-specific parsers.
- If you need multi-marketplace support, consider deploying a separate scraping service on a platform that supports headless Chromium (Render, Railway, Fly, or a VPS/Docker host), and update the backend to use Playwright for rendering.

## Configuration

- Deployed backend base URL is configured in `frontend/src/services/api.ts` (DEFAULT_API).
- Adjust thresholds and recommendation logic in the backend recommendation module if needed.

## Troubleshooting

- 400 Bad Request: ensure the submitted URL is an Amazon product page and includes the domain (https://).
- CORS issues: enable CORS on the backend or proxy requests during development.
- If reviews are missing, try a canonical Amazon product page (not a shortened or affiliate link).

## Contributing

Contributions are welcome. For multi-marketplace support, please:

- Add site-specific review URL builders and parsers.
- Add Playwright-based scraping only on Playwright-capable deployments.

Open issues or submit pull requests for enhancements or fixes.

## License

MIT License.