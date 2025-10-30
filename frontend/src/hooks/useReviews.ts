import { useState, useEffect } from 'react';
import axios from 'axios';

const useReviews = (url) => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                setLoading(true);
                const response = await axios.post('/api/v1/reviews', { url });
                setReviews(response.data);
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        if (url) {
            fetchReviews();
        }
    }, [url]);

    return { reviews, loading, error };
};

export default useReviews;