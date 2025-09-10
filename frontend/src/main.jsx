import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider, CssBaseline, Container } from "@mui/material";
import { theme } from "./theme";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <App />
      </Container>
    </ThemeProvider>
  </React.StrictMode>
);
