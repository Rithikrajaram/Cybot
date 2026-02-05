import axios from 'axios';

// Dynamic base URL for Mobile/Desktop support
export const getRawBaseUrl = () => {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${host}:5000`;
};

const api = axios.create({
    baseURL: `${getRawBaseUrl()}/api`,
    withCredentials: true,
});

export default api;
