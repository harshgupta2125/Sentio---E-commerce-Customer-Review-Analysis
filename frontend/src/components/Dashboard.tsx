import React, { useEffect, useState } from 'react';
import { fetchSentimentSummary } from '../services/api';

const Dashboard: React.FC = () => {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const getSummary = async () => {
            try {
                const data = await fetchSentimentSummary();
                setSummary(data);
            } catch (err) {
                setError('Failed to fetch sentiment summary');
            } finally {
                setLoading(false);
            }
        };

        getSummary();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>{error}</div>;
    }

    return (
        <div>
            <h1>Sentiment Analysis Summary</h1>
            {summary && (
                <div>
                    <h2>Total Reviews: {summary.totalReviews}</h2>
                    <h2>Positive Reviews: {summary.positive}</h2>
                    <h2>Negative Reviews: {summary.negative}</h2>
                    <h2>Neutral Reviews: {summary.neutral}</h2>
                </div>
            )}
        </div>
    );
};

export default Dashboard;