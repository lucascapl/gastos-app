import { useEffect, useState } from "react";
import { Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import Swal from "sweetalert2";
import { api } from "../api";

export default function ProfileSettings({ onSaved }) {
  const [form, setForm] = useState({
    initial_balance: "",
  });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/profile");
      setForm({
        initial_balance: data.initial_balance ?? "",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.patch("/profile", {
        initial_balance: Number(form.initial_balance || 0),
      });
      onSaved?.();
      Swal.fire({
        title: "Perfil atualizado!",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      const msg = err?.response?.data?.message || "Nao foi possivel salvar o perfil.";
      Swal.fire({ title: "Erro", text: msg, icon: "error" });
    }
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h4" fontWeight={700}>Perfil</Typography>
        <Typography variant="body2" color="text.secondary">
          Configure os valores iniciais usados nas projecoes acumuladas.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: { xs: "1fr", sm: "1fr auto" },
            }}
          >
            <TextField
              size="small"
              label="Saldo inicial"
              type="number"
              value={form.initial_balance}
              onChange={(event) => setForm((current) => ({ ...current, initial_balance: event.target.value }))}
              disabled={loading}
              fullWidth
            />
            <Box>
              <Button variant="contained" onClick={save} disabled={loading}>
                Salvar perfil
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
