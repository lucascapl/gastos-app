import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1565c0" },
    success: { main: "#2e7d32" },
    error:   { main: "#c62828" },
    divider: "rgba(0,0,0,0.08)"
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: 'Inter, system-ui, Roboto, "Helvetica Neue", Arial' },
});
