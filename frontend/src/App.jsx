import { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    value: "", event: "", day: "",
    category: "", payment: "", person: ""
  });

  const load = async () => {
    const { data } = await axios.get(`${API}/transactions`);
    setItems(data);
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    await axios.post(`${API}/transactions`, {
      ...form, value: Number(form.value)
    });
    setForm({ value: "", event: "", day: "", category: "", payment: "", person: "" });
    load();
  };

  return (
    <div style={{maxWidth: 900, margin: "40px auto", fontFamily: "system-ui"}}>
      <h1>Gastos</h1>
      <form onSubmit={save} style={{display:"grid", gap:8, gridTemplateColumns:"repeat(6,1fr)"}}>
        <input placeholder="Valor" value={form.value} onChange={e=>setForm(f=>({...f, value:e.target.value}))}/>
        <input placeholder="Evento" value={form.event} onChange={e=>setForm(f=>({...f, event:e.target.value}))}/>
        <input placeholder="Dia (YYYY-MM-DD)" value={form.day} onChange={e=>setForm(f=>({...f, day:e.target.value}))}/>
        <input placeholder="Categoria" value={form.category} onChange={e=>setForm(f=>({...f, category:e.target.value}))}/>
        <input placeholder="Pagamento" value={form.payment} onChange={e=>setForm(f=>({...f, payment:e.target.value}))}/>
        <input placeholder="Pessoa" value={form.person} onChange={e=>setForm(f=>({...f, person:e.target.value}))}/>
        <button type="submit" style={{gridColumn:"span 6"}}>Adicionar</button>
      </form>

      <h2 style={{marginTop:24}}>Transações</h2>
      <table width="100%" cellPadding="6">
        <thead><tr><th>Dia</th><th>Evento</th><th>Valor</th><th>Categoria</th><th>Pagamento</th><th>Pessoa</th></tr></thead>
        <tbody>
          {items.map(t=>(
            <tr key={t.id}>
              <td>{t.day}</td>
              <td>{t.event}</td>
              <td>{t.value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td>
              <td>{t.category}</td>
              <td>{t.payment}</td>
              <td>{t.person}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
