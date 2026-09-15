import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider, CssBaseline, IconButton, Tooltip } from "@mui/material";
import { getTheme } from "./theme";
import { LightMode, DarkMode } from "@mui/icons-material";

const STORAGE_KEY = "theme-mode"; // 'light' | 'dark'

function getInitialMode() {
  // 1) tenta o localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  // 2) senão, segue o sistema
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function Root() {
  const [mode, setMode] = useState(getInitialMode);
  const theme = useMemo(() => getTheme(mode), [mode]);

  // salva sempre que mudar
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // sincroniza entre abas
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        setMode(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // atualiza ao trocar o tema do sistema (só se o usuário não tiver salvo nada ainda)
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return; // usuário já escolheu
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setMode(mq.matches ? "dark" : "light");
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const toggleMode = () => setMode((m) => (m === "light" ? "dark" : "light"));

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ position: "fixed", top: 8, right: 12, zIndex: 1400 }}>
        <Tooltip title={mode === "light" ? "Usar modo escuro" : "Usar modo claro"}>
          <IconButton onClick={toggleMode} color="inherit" aria-label="Alternar tema claro/escuro">
            {mode === "light" ? <DarkMode /> : <LightMode />}
          </IconButton>
        </Tooltip>
      </div>
      <App />
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
