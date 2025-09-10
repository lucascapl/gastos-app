import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import Filters from "./components/Filters";
import Summary from "./components/Summary";
import TransactionsTable from "./components/TransactionsTable";
import TransactionForm from "./components/TransactionForm";

import { Typography, Stack } from "@mui/material";
// ...
<Stack spacing={1} sx={{ mt: 3 }}>
  <Typography variant="h3" fontWeight={700}>Gastos</Typography>
  <Typography variant="body2" color="text.secondary">Flask + React + SQLAlchemy</Typography>
</Stack>


function applyFilters(items, f) {
  return items.filter(t => {
    if (f.from && t.day < f.from) return false;
    if (f.to && t.day > f.to) return false;
    if (f.category && t.category !== f.category) return false;
    if (f.person && t.person !== f.person) return false;
    if (f.payment && t.payment !== f.payment) return false;
    if (f.q && !t.event.toLowerCase().includes(f.q.toLowerCase())) return false;
    return true;
  });
}

export default function App() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ from: "", to: "", category: "", person: "", payment: "", q: "" });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/transactions");
    // garante string ISO em day
    const normalized = data.map(t => ({ ...t, day: t.day?.slice(0, 10) }));
    setItems(normalized);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => applyFilters(items, filters), [items, filters]);

  const create = async (payload) => {
    await api.post("/transactions", payload);
    await load();
  };

  return (
    <div style={{ maxWidth: 1000, margin: "36px auto", padding: "0 16px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1 style={{ margin: 0 }}>Gastos</h1>
      <div style={{ color: "#666", marginTop: 4 }}>Flask + React + SQLAlchemy</div>

      <TransactionForm onSubmit={create} />
      <Filters data={items} value={filters} onChange={setFilters} />
      <Summary items={filtered} />

      {loading ? <div>Carregando...</div> : <TransactionsTable items={filtered} />}
    </div>
  );
}
