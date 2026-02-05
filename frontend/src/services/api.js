import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
});

export const login = async (device_id, token) => {
    return api.post('/login', { device_id, token });
};

export const register = async (device_name) => {
    return api.post('/register', { device_name });
};

export const getDashboard = async () => {
    return api.get('/dashboard');
};

export const getLogs = async () => {
    return api.get('/logs');
};

export const logout = async () => {
    return api.get('/logout');
};

// --- Face Auth ---
export const registerFace = async (username, images) => {
    return api.post('/face/register', { username, images });
};

export const loginFace = async (username, livenessData) => {
    return api.post('/face/login', {
        username,
        liveness_images: livenessData.liveness_images,
        match_image: livenessData.match_image
    });
};

export default api;
