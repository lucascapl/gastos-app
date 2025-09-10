import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // ex.: http://localhost:5000
});

// tenta /whoami; se não existir, usa /balance
export async function getOwner() {
  try {
    const { data } = await api.get("/whoami");
    console.log(data.owner);
    
    return data.owner;
  } catch {
    const { data } = await api.get("/balance");
    return data.owner;
  }
}