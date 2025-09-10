import { createTheme } from "@mui/material/styles";

export const getTheme = (mode = "light") =>
  createTheme({
    palette: {
      mode,
      primary: { main: "#1565c0" },
      success: { main: "#2e7d32" },
      error:   { main: "#c62828" },
    },
    shape: { borderRadius: 12 },
    typography: { fontFamily: 'Inter, system-ui, Roboto, "Helvetica Neue", Arial' },
  });
