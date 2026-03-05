import { useEffect, useMemo, useState } from "react";
import { api, getOwner } from "./api";
import Filters from "./components/Filters";
import Summary from "./components/Summary";
import TransactionsTable from "./components/TransactionsTable";
import TransactionForm from "./components/TransactionForm";
import BillingCycleBar from "./components/BillingCycleBar";
import BalanceCard from "./components/BalanceCard";
import WelcomeModal from "./components/WelcomeModal";
import { Typography, Stack, Button } from "@mui/material";

import Login from "./pages/Login";
import Register from "./pages/Register"; // se não criar, remova esse import e o fluxo de register
import { clearToken, isLoggedIn } from "./auth";

function applyFilters(items, f) {
  return items.filter((t) => {
    if (f.from && t.day < f.from) return false;
    if (f.to && t.day > f.to) return false;
    if (f.category && t.category !== f.category) return false;
    if (f.person && t.person !== f.person) return false;
    if (f.payment && t.payment !== f.payment) return false;
    if (f.q) {
      const ev = (t.event || "").toString().toLowerCase();
      if (!ev.includes(f.q.toLowerCase())) return false;
    }
    return true;
  });
}

export default function App() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({
    from: "", to: "", category: "", person: "", payment: "", q: ""
  });
  const [loading, setLoading] = useState(false);
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const [owner, setOwner] = useState(null);
  const [optionsVersion, setOptionsVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState("login"); // "login" | "register" | "app"

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/transactions");
      const normalized = data.map((t) => ({ ...t, day: t.day?.slice(0, 10) }));
      setItems(normalized);
    } finally {
      setLoading(false);
    }
  };

  const boot = async () => {
    setReady(false);

    if (!isLoggedIn()) {
      setOwner(null);
      setItems([]);
      setScreen("login");
      setReady(true);
      return;
    }

    const o = await getOwner(); // /whoami (com token)
    if (!o) {
      // token inválido/expirado -> interceptor limpou
      setOwner(null);
      setItems([]);
      setScreen("login");
      setReady(true);
      return;
    }

    setOwner(o);
    setScreen("app");
    await load();
    setReady(true);
  };

  useEffect(() => { boot(); }, []);

  const filtered = useMemo(() => applyFilters(items, filters), [items, filters]);

  const create = async (payload) => {
    await api.post("/transactions", payload);
    await load();
    setBalanceRefresh((x) => x + 1);
    setOptionsVersion((x) => x + 1);
  };

  const logout = () => {
    clearToken();
    setOwner(null);
    setItems([]);
    setScreen("login");
  };

  if (!ready) return null;

  if (screen === "login") {
    return (
      <Login
        onLoggedIn={boot}
        onGoRegister={() => setScreen("register")}
      />
    );
  }

  if (screen === "register") {
    return (
      <Register
        onLoggedIn={boot}
        onGoLogin={() => setScreen("login")}
      />
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "36px auto", padding: "0 16px" }}>
      <WelcomeModal/>
      <Stack spacing={1} sx={{ mt: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <div>
            <Typography variant="h3" fontWeight={700}>Balance.io</Typography>
            <Typography variant="body2" color="text.secondary">
              Bem vindo, <b>{owner}!</b>
            </Typography>
          </div>

          <Button variant="outlined" onClick={logout}>Sair</Button>
        </Stack>
      </Stack>

      <BillingCycleBar
        onChange={(f) => {
          setFilters((prev) => ({
            ...prev,
            from: f.from,
            to: f.to,
            payment: f.payment
          }));
        }}
      />

      <TransactionForm onSubmit={create} owner={owner} optionsVersion={optionsVersion} />
      <BalanceCard refreshKey={balanceRefresh} owner={owner} />
      <Filters data={items} value={filters} onChange={setFilters} />
      <Summary items={filtered} />

      {loading ? (
        <div>Carregando...</div>
      ) : (
        <TransactionsTable
          items={filtered}
          optionsVersion={optionsVersion}
          onSaved={() => {
            (async () => {
              await load();
              setBalanceRefresh((x) => x + 1);
            })();
          }}
        />
      )}
    </div>
  );
}
