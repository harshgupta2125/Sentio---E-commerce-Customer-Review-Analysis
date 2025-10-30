# Sentio - E-commerce Customer Review Analysis

Sentio is a web application designed to analyze customer reviews from e-commerce platforms. It utilizes a combination of web scraping, sentiment analysis, and a user-friendly dashboard to provide insights into customer feedback.

## Features

- **Web Scraping**: Automatically extracts customer reviews from specified e-commerce product pages.
- **Sentiment Analysis**: Analyzes the sentiment of the reviews using advanced machine learning models.
- **Summary Dashboard**: Displays a comprehensive overview of the sentiment analysis results, including visualizations and statistics.

## Tech Stack

- **Frontend**: Built with React and TypeScript for a responsive and interactive user interface.
- **Backend**: Developed using Python with FastAPI for efficient API handling and data processing.
- **Database**: Utilizes a database for storing review data and analysis results.

## Getting Started

### Prerequisites

- Python 3.7 or higher
- Node.js and npm
- Docker (optional, for containerization)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/sentio.git
   cd sentio
   ```

2. Set up the backend:
   - Navigate to the backend directory:
     ```
     cd backend
     ```
   - Install the required Python packages:
     ```
     pip install -r requirements.txt
     ```

3. Set up the frontend:
   - Navigate to the frontend directory:
     ```
     cd frontend
     ```
   - Install the required Node.js packages:
     ```
     npm install
     ```

### Running the Application

#### Backend

1. Start the FastAPI server:
   ```
   uvicorn app.main:app --reload
   ```

#### Frontend

1. Start the React application:
   ```
   npm start
   ```

### Usage

- Access the application in your web browser at `http://localhost:3000`.
- Enter the URL of the e-commerce product page you want to analyze and submit the form.
- View the sentiment analysis results on the dashboard.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.