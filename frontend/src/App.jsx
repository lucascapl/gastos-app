import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getOwner } from "./api";
import Filters from "./components/Filters";
import TransactionsTable from "./components/TransactionsTable";
import TransactionForm from "./components/TransactionForm";
import BillingCycleBar from "./components/BillingCycleBar";
import BalanceCard from "./components/BalanceCard";
import InvoiceBreakdownCard from "./components/InvoiceBreakdownCard";
import WelcomeModal from "./components/WelcomeModal";
import ReferenceDataEditor from "./components/ReferenceDataEditor";
import InvoiceSummary from "./components/InvoiceSummary";
import AnnualProjection from "./components/AnnualProjection";
import InvestmentsView from "./components/InvestmentsView";
import ProfileSettings from "./components/ProfileSettings";
import {
  Box,
  Button,
  Divider,
  Drawer,
  Grid,
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
import ShowChartIcon from "@mui/icons-material/ShowChart";
import SavingsIcon from "@mui/icons-material/Savings";
import PersonIcon from "@mui/icons-material/Person";

import Login from "./pages/Login";
import Register from "./pages/Register"; // se não criar, remova esse import e o fluxo de register
import { clearToken, isLoggedIn } from "./auth";

const drawerWidth = 220;

function viewFromPath() {
  if (window.location.pathname === "/profile") return "profile";
  if (window.location.pathname === "/investments") return "investments";
  if (window.location.pathname === "/projection") return "projection";
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
  const [profile, setProfile] = useState(null);
  const [showTransactionForm, setShowTransactionForm] = useState(true);

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

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get("/profile");
      setProfile(data);
      return data;
    } catch {
      setProfile(null);
      return null;
    }
  }, []);

  const boot = useCallback(async () => {
    setReady(false);

    if (!isLoggedIn()) {
      setOwner(null);
      setItems([]);
      setProfile(null);
      setScreen("login");
      setReady(true);
      return;
    }

    const o = await getOwner(); // /whoami (com token)
    if (!o) {
      // token inválido/expirado -> interceptor limpou
      setOwner(null);
      setItems([]);
      setProfile(null);
      setScreen("login");
      setReady(true);
      return;
    }

    setOwner(o);
    setScreen("app");
    await loadProfile();
    await load();
    setReady(true);
  }, [load, loadProfile]);

  useEffect(() => { boot(); }, [boot]);

  const cashFlowItems = useMemo(() => {
    return items.filter((item) => !item.is_projected);
  }, [items]);
  const cashFlowFiltered = useMemo(() => applyFilters(cashFlowItems, filters), [cashFlowItems, filters]);

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
    setProfile(null);
    setScreen("login");
  };

  const navigateApp = (view) => {
    setAppView(view);
    const path = view === "edit"
      ? "/edit"
      : view === "summary"
        ? "/summary"
        : view === "projection"
          ? "/projection"
          : view === "investments"
            ? "/investments"
            : view === "profile"
              ? "/profile"
              : "/cash-flow";
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
            <ListItemText primary="Fluxo de caixa" />
          </ListItemButton>
          <ListItemButton selected={appView === "projection"} onClick={() => navigateApp("projection")}>
            <ListItemIcon><ShowChartIcon /></ListItemIcon>
            <ListItemText primary="Projecao anual" />
          </ListItemButton>
          <ListItemButton selected={appView === "investments"} onClick={() => navigateApp("investments")}>
            <ListItemIcon><SavingsIcon /></ListItemIcon>
            <ListItemText primary="Investimentos" />
          </ListItemButton>
          <ListItemButton selected={appView === "edit"} onClick={() => navigateApp("edit")}>
            <ListItemIcon><EditIcon /></ListItemIcon>
            <ListItemText primary="Edicao" />
          </ListItemButton>
          <ListItemButton selected={appView === "profile"} onClick={() => navigateApp("profile")}>
            <ListItemIcon><PersonIcon /></ListItemIcon>
            <ListItemText primary="Perfil" />
          </ListItemButton>
          <ListItemButton selected={appView === "summary"} onClick={() => navigateApp("summary")}>
            <ListItemIcon><ReceiptLongIcon /></ListItemIcon>
            <ListItemText primary="Resumo de fatura" />
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
              Fluxo
            </Button>
            <Button
              variant={appView === "projection" ? "contained" : "outlined"}
              onClick={() => navigateApp("projection")}
            >
              Projecao
            </Button>
            <Button
              variant={appView === "investments" ? "contained" : "outlined"}
              onClick={() => navigateApp("investments")}
            >
              Invest.
            </Button>
            <Button
              variant={appView === "edit" ? "contained" : "outlined"}
              onClick={() => navigateApp("edit")}
            >
              Edicao
            </Button>
            <Button
              variant={appView === "profile" ? "contained" : "outlined"}
              onClick={() => navigateApp("profile")}
            >
              Perfil
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
        ) : appView === "profile" ? (
          <ProfileSettings onSaved={loadProfile} />
        ) : appView === "summary" ? (
          <InvoiceSummary items={cashFlowItems} />
        ) : appView === "investments" ? (
          <>
            <Stack spacing={1} sx={{ display: { xs: "none", md: "block" } }}>
              <Typography variant="h3" fontWeight={700}>Investimentos</Typography>
              <Typography variant="body2" color="text.secondary">
                Aplicacoes e resgates de <b>{owner}</b> em 2026.
              </Typography>
            </Stack>

            <InvestmentsView
              items={items}
              owner={owner}
              optionsVersion={optionsVersion}
              profile={profile}
              onSaved={() => {
                (async () => {
                  await load({ showLoading: false });
                  setBalanceRefresh((x) => x + 1);
                  setOptionsVersion((x) => x + 1);
                })();
              }}
            />
          </>
        ) : appView === "projection" ? (
          <>
            <Stack spacing={1} sx={{ display: { xs: "none", md: "block" } }}>
              <Typography variant="h3" fontWeight={700}>Projecao anual</Typography>
              <Typography variant="body2" color="text.secondary">
                Planejamento, contas previstas e análises de <b>{owner}</b>.
              </Typography>
            </Stack>

            <AnnualProjection
              items={items}
              owner={owner}
              optionsVersion={optionsVersion}
              onCreate={create}
              onSaved={() => {
                (async () => {
                  await load({ showLoading: false });
                  setBalanceRefresh((x) => x + 1);
                  setOptionsVersion((x) => x + 1);
                })();
              }}
            />
          </>
        ) : (
          <>
            <Stack spacing={1} sx={{ display: { xs: "none", md: "block" } }}>
              <Typography variant="h3" fontWeight={700}>Fluxo de caixa</Typography>
              <Typography variant="body2" color="text.secondary">
                Mes e fatura atuais, sem entradas e saidas futuras.
              </Typography>
            </Stack>

            <BillingCycleBar
              onChange={(f) => {
                setFilters((prev) => ({
                  ...prev,
                  from: f.from,
                  to: f.to,
                  payment: f.payment,
                  bank: f.bank || ""
                }));
              }}
            />

            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setShowTransactionForm((value) => !value)}
              >
                {showTransactionForm ? "Ocultar" : "Mostrar"}
              </Button>
            </Stack>
            {showTransactionForm && (
              <TransactionForm
                onSubmit={create}
                owner={owner}
                optionsVersion={optionsVersion}
                defaultProjected={false}
              />
            )}
            <Grid container spacing={2} sx={{ mt: 1 }} justifyContent="center">
              <Grid item xs={12} md={7}>
                <BalanceCard owner={owner} items={cashFlowItems} profile={profile} />
              </Grid>
            </Grid>
            <Filters data={cashFlowItems} value={filters} onChange={setFilters} />
            <InvoiceBreakdownCard items={cashFlowFiltered} owner={owner} filters={filters} />

            {loading ? (
              <div>Carregando...</div>
            ) : (
              <TransactionsTable
                items={cashFlowFiltered}
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
