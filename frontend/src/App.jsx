import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getOwner } from "./api";
import Filters from "./components/Filters";
import Summary from "./components/Summary";
import TransactionsTable from "./components/TransactionsTable";
import TransactionForm from "./components/TransactionForm";
import BillingCycleBar from "./components/BillingCycleBar";
import BalanceCard from "./components/BalanceCard";
import WelcomeModal from "./components/WelcomeModal";
import ReferenceDataEditor from "./components/ReferenceDataEditor";
import InvoiceSummary from "./components/InvoiceSummary";
import {
  Box,
  Button,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import HomeIcon from "@mui/icons-material/Home";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";

import Login from "./pages/Login";
import Register from "./pages/Register"; // se não criar, remova esse import e o fluxo de register
import { clearToken, isLoggedIn } from "./auth";

const drawerWidth = 220;

function viewFromPath() {
  if (window.location.pathname === "/summary") return "summary";
  return window.location.pathname === "/edit" ? "edit" : "home";
}

function applyFilters(items, f) {
  return items.filter((t) => {
    if (f.from && t.day < f.from) return false;
    if (f.to && t.day > f.to) return false;
    if (f.category && t.category !== f.category) return false;
    if (f.bank && t.bank !== f.bank) return false;
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
    from: "", to: "", category: "", bank: "", person: "", payment: "", q: ""
  });
  const [loading, setLoading] = useState(false);
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const [owner, setOwner] = useState(null);
  const [optionsVersion, setOptionsVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState("login"); // "login" | "register" | "app"
  const [appView, setAppView] = useState(viewFromPath);

  useEffect(() => {
    const handlePopState = () => setAppView(viewFromPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const load = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const { data } = await api.get("/transactions");
      const normalized = data.map((t) => ({ ...t, day: t.day?.slice(0, 10) }));
      setItems(normalized);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const boot = useCallback(async () => {
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
  }, [load]);

  useEffect(() => { boot(); }, [boot]);

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

  const navigateApp = (view) => {
    setAppView(view);
    const path = view === "edit" ? "/edit" : view === "summary" ? "/summary" : "/home";
    window.history.pushState({}, "", path);
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
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <WelcomeModal/>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        <Box sx={{ px: 2, py: 2.5 }}>
          <Typography variant="h6" fontWeight={700}>Balance.io</Typography>
          <Typography variant="caption" color="text.secondary">
            {owner}
          </Typography>
        </Box>
        <Divider />
        <List>
          <ListItemButton selected={appView === "home"} onClick={() => navigateApp("home")}>
            <ListItemIcon><HomeIcon /></ListItemIcon>
            <ListItemText primary="Home" />
          </ListItemButton>
          <ListItemButton selected={appView === "edit"} onClick={() => navigateApp("edit")}>
            <ListItemIcon><EditIcon /></ListItemIcon>
            <ListItemText primary="Edicao" />
          </ListItemButton>
          <ListItemButton selected={appView === "summary"} onClick={() => navigateApp("summary")}>
            <ListItemIcon><ReceiptLongIcon /></ListItemIcon>
            <ListItemText primary="Resumo" />
          </ListItemButton>
        </List>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ p: 2 }}>
          <Button variant="outlined" onClick={logout} fullWidth>Sair</Button>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          maxWidth: 1280,
          mx: "auto",
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 4 },
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          gap={1.5}
          sx={{ display: { md: "none" }, mb: 2 }}
        >
          <Box>
            <Typography variant="h4" fontWeight={700}>Balance.io</Typography>
            <Typography variant="body2" color="text.secondary">
              Bem vindo, <b>{owner}!</b>
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant={appView === "home" ? "contained" : "outlined"}
              onClick={() => navigateApp("home")}
            >
              Home
            </Button>
            <Button
              variant={appView === "edit" ? "contained" : "outlined"}
              onClick={() => navigateApp("edit")}
            >
              Edicao
            </Button>
            <Button
              variant={appView === "summary" ? "contained" : "outlined"}
              onClick={() => navigateApp("summary")}
            >
              Resumo
            </Button>
            <Button variant="outlined" onClick={logout}>Sair</Button>
          </Stack>
        </Stack>

        {appView === "edit" ? (
          <ReferenceDataEditor
            onChanged={() => {
              setOptionsVersion((x) => x + 1);
              load();
            }}
          />
        ) : appView === "summary" ? (
          <InvoiceSummary items={items} />
        ) : (
          <>
            <Stack spacing={1} sx={{ display: { xs: "none", md: "block" } }}>
              <Typography variant="h3" fontWeight={700}>Home</Typography>
              <Typography variant="body2" color="text.secondary">
                Bem vindo, <b>{owner}!</b>
              </Typography>
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
                    await load({ showLoading: false });
                    setBalanceRefresh((x) => x + 1);
                    setOptionsVersion((x) => x + 1);
                  })();
                }}
              />
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
