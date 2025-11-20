# Stock Analysis Tool

A modern, Flask-based web application that provides real-time stock analysis, news aggregation, and AI-powered insights using OpenAI's GPT models.

## 🏗️ Architecture Overview

The application follows a standard Model-View-Controller (MVC) pattern adapted for Flask:

*   **Frontend**: HTML5, CSS3 (Custom "Neo-Fintech" design + Bootstrap 5), JavaScript (Fetch API, Chart.js for visualization).
*   **Backend**: Python (Flask).
*   **Data Layer**:
    *   `yfinance`: Fetches real-time stock data and historical prices.
    *   `ta`: Python Technical Analysis library for calculating indicators (RSI, MACD, Bollinger Bands).
    *   `scikit-learn`: Performs simple Linear Regression for price trend forecasting.
*   **External APIs**:
    *   **OpenAI API**: Generates qualitative analysis and summaries of the stock.
    *   **NewsAPI**: Fetches recent news articles related to the stock ticker.
*   **Caching**: `Flask-Caching` with `FileSystemCache` to store expensive API responses and reduce latency/costs.

### Key Components

*   `app.py`: Main entry point. Handles routing, API requests, caching logic, and ML calculations.
*   `templates/index.html`: Single-page application interface.
*   `static/style.css`: Custom styling including glassmorphism effects and responsive design.
*   `static/script.js`: Frontend logic for fetching data asynchronously, rendering charts, and managing tabs.
*   `flask_cache/`: Directory where cached data is stored (created at runtime).

---

## 🚀 How to Run Locally

### Prerequisites

*   Python 3.10+
*   Pip (Python Package Manager)
*   API Keys for:
    *   OpenAI
    *   NewsAPI.org

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd stock-new
    ```

2.  **Create a virtual environment:**
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure Environment Variables:**
    Create a `.env` file in the root directory:
    ```ini
    OPENAI_API_KEY=your_openai_key_here
    NEWS_API_KEY=your_newsapi_key_here
    OPENAI_MODEL=gpt-5-mini-2025-08-07
    ```

5.  **Run the application:**
    ```bash
    python app.py
    ```
    Access the app at `http://127.0.0.1:5000`.

---

## ☁️ Migration to Google Cloud Run

Google Cloud Run is a managed compute platform that lets you run containers directly on top of Google's scalable infrastructure.

### 1. Prepare the Application
A `Dockerfile` is already included in this repository. Ensure `gunicorn` is in your `requirements.txt`.

### 2. Build the Container Image
You need the Google Cloud CLI (`gcloud`) installed.

```bash
# Set your project ID
export PROJECT_ID=your-google-cloud-project-id

# Build and submit the image to Google Container Registry (GCR) or Artifact Registry
gcloud builds submit --tag gcr.io/$PROJECT_ID/stock-analysis-tool
```

### 3. Deploy to Cloud Run

```bash
gcloud run deploy stock-analysis-tool \
  --image gcr.io/$PROJECT_ID/stock-analysis-tool \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY=your_key,NEWS_API_KEY=your_key
```

*Note: For production, use Google Secret Manager to handle API keys securely instead of passing them as plain environment variables.*

---

## 🔄 CI/CD Pipeline (GitHub Actions)

To automate deployment, you can use GitHub Actions. Create a file `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  RUN_REGION: us-central1
  SERVICE_NAME: stock-analysis-tool

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Google Auth
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v1

      - name: Build and Push Container
        run: |
          gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy $SERVICE_NAME \
            --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
            --region $RUN_REGION \
            --platform managed \
            --allow-unauthenticated \
            --set-env-vars OPENAI_API_KEY=${{ secrets.OPENAI_KEY }},NEWS_API_KEY=${{ secrets.NEWS_KEY }}
```

**Required GitHub Secrets:**
*   `GCP_PROJECT_ID`: Your Google Cloud Project ID.
*   `GCP_SA_KEY`: JSON key of a Service Account with permissions to push to GCR/Artifact Registry and deploy to Cloud Run.
*   `OPENAI_KEY`: Your OpenAI API Key.
*   `NEWS_KEY`: Your NewsAPI Key.

---

## 🛡️ Cloudflare Integration

Implemented Cloudflare for DDoS protection, CDN, and DNS management

**Quick Summary:**
1.  **Add Site**: Sign up for Cloudflare and add your domain.
2.  **Update DNS**: Change your domain's nameservers to the ones provided by Cloudflare.
3.  **Proxy Traffic**: Create a CNAME record pointing to your Cloud Run URL (e.g., `stock-tool-xyz.a.run.app`) and enable "Proxied" status.
4.  **SSL/TLS**: Set mode to "Full (Strict)".

