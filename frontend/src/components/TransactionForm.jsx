import { useState } from "react";
import { Grid, TextField, Button, Card, CardContent } from "@mui/material";

export default function TransactionForm({ onSubmit }) {
  const [form, setForm] = useState({
    value: "", event: "", day: "",
    category: "", payment: "", person: ""
  });
  const patch = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    await onSubmit({ ...form, value: Number(form.value) });
    setForm({ value: "", event: "", day: "", category: "", payment: "", person: "" });
  };

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent component="form" onSubmit={submit}>
        <Grid container spacing={1}>
          <Grid item xs={12} sm={2}>
            <TextField size="small" label="Valor (ex: -120.50)"
              value={form.value} onChange={e=>patch("value", e.target.value)} fullWidth />
          </Grid>
          <Grid item xs={12} sm={2.4}>
            <TextField size="small" label="Evento"
              value={form.event} onChange={e=>patch("event", e.target.value)} fullWidth />
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField size="small" label="Dia" type="date"
              value={form.day} onChange={e=>patch("day", e.target.value)}
              fullWidth InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={1.8}>
            <TextField size="small" label="Categoria"
              value={form.category} onChange={e=>patch("category", e.target.value)} fullWidth />
          </Grid>
          <Grid item xs={12} sm={1.8}>
            <TextField size="small" label="Pagamento"
              value={form.payment} onChange={e=>patch("payment", e.target.value)} fullWidth />
          </Grid>
          <Grid item xs={12} sm={1.8}>
            <TextField size="small" label="Pessoa"
              value={form.person} onChange={e=>patch("person", e.target.value)} fullWidth />
          </Grid>
          <Grid item xs={12}>
            <Button type="submit" variant="contained">Adicionar</Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
