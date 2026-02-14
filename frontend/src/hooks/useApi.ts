import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001',
  timeout: 120_000,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config || config._retryCount >= 1) return Promise.reject(error);

    const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
    const isNetworkError = !error.response && error.message === 'Network Error';

    if (isTimeout || isNetworkError) {
      config._retryCount = (config._retryCount || 0) + 1;
      await new Promise((r) => setTimeout(r, 2000));
      return api(config);
    }

    return Promise.reject(error);
  }
);

export function useApi() {
  return api;
}

export default api;
