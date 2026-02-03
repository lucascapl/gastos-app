import { useState } from "react";
import { api } from "../api";
import { setToken } from "../auth";
import { Box, Card, CardContent, TextField, Button, Typography, Stack } from "@mui/material";

export default function Register({ onLoggedIn, onGoLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    try {
      const { data } = await api.post("/auth/register", { username, password });
      setToken(data.access_token);
      onLoggedIn?.();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Falha no cadastro");
    }
  };

  return (
    <Box sx={{ minHeight: "70vh", display: "grid", placeItems: "center", p: 2 }}>
      <Card sx={{ width: "100%", maxWidth: 420 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={800}>Criar conta</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Cadastre um usuário e comece a usar.
          </Typography>

          <Stack component="form" spacing={1.5} onSubmit={submit}>
            <TextField label="Usuário" value={username} onChange={(e)=>setUsername(e.target.value)} size="small" />
            <TextField label="Senha" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} size="small" />
            {err && <Typography color="error" variant="body2">{err}</Typography>}

            <Button type="submit" variant="contained">CADASTRAR</Button>
            <Button variant="text" onClick={onGoLogin}>
              Já tenho conta
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
