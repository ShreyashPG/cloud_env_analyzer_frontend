import axios from 'axios';
import { API_BASE_URL } from '../lib/constants';

const client = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
});

// Request interceptor — log requests in dev
client.interceptors.request.use((config) => {
    if (import.meta.env.DEV) {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
});

// Response interceptor — handle errors globally
client.interceptors.response.use(
    (res) => res,
    (err) => {
        const msg =
            err.response?.data?.message ?? err.message ?? 'An unexpected error occurred';
        console.error('[API Error]', msg);
        return Promise.reject(new Error(msg));
    }
);

export default client;
