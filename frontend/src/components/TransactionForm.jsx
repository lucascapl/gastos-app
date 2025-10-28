import { useEffect, useState } from "react";
import { Grid, TextField, Button, Card, CardContent, Autocomplete, Box } from "@mui/material";
import { api } from "../api";

export default function TransactionForm({ onSubmit, owner, optionsVersion }) {
  const [form, setForm] = useState({
    value: "", event: "", day: "",
    category: "", payment: "", person: ""
  });

  const [opts, setOpts] = useState({ categories: [], payment_methods: [], people: [] });

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/transactions/options");
        setOpts(data);
      } catch (e) {
        // silencioso; o form ainda funciona com texto livre
      }
    };
    load();
  }, [optionsVersion]);

  const patch = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    await onSubmit({ ...form, value: Number(form.value) });
    setForm({ value: "", event: "", day: "", category: "", payment: "", person: "" });
  };

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Box
          component="form"
          onSubmit={submit}
          noValidate
          autoComplete="off"
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              md: "1fr 1fr 1fr",
            },
          }}
        >
          {/* Valor */}
          <Box sx={{ minWidth: 0 }}>
            <TextField
              size="small"
              label="Valor (ex: -120.50)"
              value={form.value}
              onChange={(e) => patch("value", e.target.value)}
              fullWidth
            />
          </Box>

          {/* Evento */}
          <Box sx={{ minWidth: 0 }}>
            <TextField
              size="small"
              label="Evento"
              value={form.event}
              onChange={(e) => patch("event", e.target.value)}
              fullWidth
            />
          </Box>

          {/* Dia */}
          <Box sx={{ minWidth: 0 }}>
            <TextField
              size="small"
              label="Dia"
              type="date"
              value={form.day}
              onChange={(e) => patch("day", e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ "& input": { width: "100%" } }}
            />
          </Box>

          {/* Categoria */}
          <Box sx={{ minWidth: 0 }}>
            <Autocomplete
              fullWidth
              freeSolo
              options={opts.categories}
              value={form.category || null}
              onChange={(_, newValue) => patch("category", newValue || "")}
              inputValue={form.category}
              onInputChange={(_, newInput) => patch("category", newInput)}
              renderInput={(params) => (
                <TextField {...params} size="small" label="Categoria" fullWidth />
              )}
            />
          </Box>

          {/* Pagamento */}
          <Box sx={{ minWidth: 0 }}>
            <Autocomplete
              fullWidth
              freeSolo
              options={opts.payment_methods}
              value={form.payment || null}
              onChange={(_, newValue) => patch("payment", newValue || "")}
              inputValue={form.payment}
              onInputChange={(_, newInput) => patch("payment", newInput)}
              renderInput={(params) => (
                <TextField {...params} size="small" label="Pagamento" fullWidth />
              )}
            />
          </Box>

          {/* Pessoa */}
          <Box sx={{ minWidth: 0 }}>
            <Autocomplete
              fullWidth
              freeSolo
              options={opts.people}
              value={form.person || null}
              onChange={(_, newValue) => patch("person", newValue || "")}
              inputValue={form.person}
              onInputChange={(_, newInput) => patch("person", newInput)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label={`Pessoa (vazio = ${owner})`}
                  fullWidth
                />
              )}
            />
          </Box>

          {/* Botão */}
          <Box sx={{ gridColumn: "1 / -1", width: "100%" }}>
            <Button type="submit" variant="contained" sx={{ width: "100%" }}>
              ADICIONAR
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
