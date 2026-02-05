import axios from 'axios';

// Dynamic base URL for Mobile/Desktop support
const getBaseUrl = () => {
    const host = window.location.hostname;
    // Assume backend is always on port 5000 of the same host
    // Use HTTPS if the frontend is HTTPS to avoid Mixed Content errors
    const protocol = window.location.protocol;
    return `${protocol}//${host}:5000/api`;
};

const api = axios.create({
    baseURL: getBaseUrl(),
    withCredentials: true,
});

export default api;
