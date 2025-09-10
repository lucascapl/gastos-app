import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // ex.: http://localhost:5000
});
