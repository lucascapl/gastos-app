import axios from "axios";
import { getToken, clearToken } from "./auth";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // http://localhost:5000
});

// request: injeta Authorization
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// response: se token inválido/expirado, limpa e deixa o app decidir o fluxo
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      clearToken();
    }
    return Promise.reject(err);
  }
);

// agora /whoami sempre com token; se falhar, retorna null
export async function getOwner() {
  try {
    const { data } = await api.get("/whoami");
    return data.owner;
  } catch {
    return null;
  }
}
