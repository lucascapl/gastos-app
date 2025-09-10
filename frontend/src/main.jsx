import React, { useState, useMemo } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider, CssBaseline, Container, IconButton } from "@mui/material";
import { getTheme } from "./theme";
import { LightMode, DarkMode } from "@mui/icons-material";

function Root() {
  const [mode, setMode] = useState("light");
  const theme = useMemo(() => getTheme(mode), [mode]);

  const toggleMode = () => setMode((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 0" }}>
          <IconButton onClick={toggleMode} color="inherit">
            {mode === "light" ? <DarkMode /> : <LightMode />}
          </IconButton>
        </div>
        <App />
      </Container>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
