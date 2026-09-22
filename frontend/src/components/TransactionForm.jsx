import { useEffect, useState } from "react";
import {
  TextField,
  Button,
  Card,
  CardContent,
  Autocomplete,
  Box,
  FormControlLabel,
  MenuItem,
  Switch,
  Typography,
} from "@mui/material";
import { api } from "../api";

const AUTOFILL_KEY = "transaction-autofill";

const emptyForm = {
  value: "",
  event: "",
  day: "",
  category: "",
  bank: "",
  payment: "",
  person: "",
  is_projected: false,
  splitEnabled: false,
  automation_mode: "single",
  repeat_count: "",
  repeat_until: "",
  split_person_1: "",
  split_percent_1: "70",
  split_person_2: "",
  split_percent_2: "30",
};

function getInitialForm(defaultProjected = false) {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTOFILL_KEY) || "{}");
    return {
      ...emptyForm,
      is_projected: defaultProjected,
      day: saved.day || "",
      payment: saved.payment || "",
      person: saved.person || "",
    };
  } catch {
    return { ...emptyForm, is_projected: defaultProjected };
  }
}

export default function TransactionForm({ onSubmit, owner, optionsVersion, defaultProjected = false }) {
  const [form, setForm] = useState(() => getInitialForm(defaultProjected));

  const [opts, setOpts] = useState({ categories: [], banks: [], payment_methods: [], people: [] });

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/transactions/options");
        setOpts(data);
      } catch {
        // silencioso; o form ainda funciona com texto livre
      }
    };
    load();
  }, [optionsVersion]);

  const patch = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      value: Number(form.value),
      repeat_count: form.repeat_count ? Number(form.repeat_count) : undefined,
    };

    if (form.splitEnabled) {
      const percent1 = Number(form.split_percent_1);
      const percent2 = Number(form.split_percent_2);
      if (!form.split_person_2 || percent1 <= 0 || percent2 <= 0 || Math.round((percent1 + percent2) * 100) / 100 !== 100) {
        window.alert("Informe a segunda pessoa e percentuais que somem 100%.");
        return;
      }
      payload.splits = [
        { person: form.split_person_1 || owner, percent: percent1 },
        { person: form.split_person_2, percent: percent2 },
      ];
      payload.person = "";
    }

    await onSubmit(payload);
    const autofill = {
      day: form.day,
      payment: form.payment,
      person: form.person,
    };
    localStorage.setItem(AUTOFILL_KEY, JSON.stringify(autofill));
    setForm({
      ...emptyForm,
      ...autofill,
      is_projected: defaultProjected,
      split_person_1: owner || "",
    });
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

          {/* Banco */}
          <Box sx={{ minWidth: 0 }}>
            <Autocomplete
              fullWidth
              freeSolo
              options={opts.banks || []}
              value={form.bank || null}
              onChange={(_, newValue) => patch("bank", newValue || "")}
              inputValue={form.bank}
              onInputChange={(_, newInput) => patch("bank", newInput)}
              renderInput={(params) => (
                <TextField {...params} size="small" label="Banco" fullWidth />
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

          <Box sx={{ minWidth: 0 }}>
            <TextField
              select
              size="small"
              label="Status"
              value={form.is_projected ? "projected" : "realized"}
              onChange={(e) => patch("is_projected", e.target.value === "projected")}
              fullWidth
            >
              <MenuItem value="realized">Realizada</MenuItem>
              <MenuItem value="projected">Projetada</MenuItem>
            </TextField>
          </Box>

          <Box sx={{ gridColumn: "1 / -1", mt: 0.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Divisao da transacao
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={form.splitEnabled}
                  onChange={(e) => patch("splitEnabled", e.target.checked)}
                />
              }
              label="Dividir entre duas pessoas"
            />
          </Box>

          {form.splitEnabled && (
            <>
              <Box sx={{ minWidth: 0 }}>
                <Autocomplete
                  fullWidth
                  freeSolo
                  options={opts.people}
                  value={form.split_person_1 || null}
                  onChange={(_, newValue) => patch("split_person_1", newValue || "")}
                  inputValue={form.split_person_1}
                  onInputChange={(_, newInput) => patch("split_person_1", newInput)}
                  renderInput={(params) => (
                    <TextField {...params} size="small" label={`Pessoa 1 (vazio = ${owner})`} fullWidth />
                  )}
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <TextField
                  size="small"
                  label="% pessoa 1"
                  type="number"
                  value={form.split_percent_1}
                  onChange={(e) => patch("split_percent_1", e.target.value)}
                  fullWidth
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Autocomplete
                  fullWidth
                  freeSolo
                  options={opts.people}
                  value={form.split_person_2 || null}
                  onChange={(_, newValue) => patch("split_person_2", newValue || "")}
                  inputValue={form.split_person_2}
                  onInputChange={(_, newInput) => patch("split_person_2", newInput)}
                  renderInput={(params) => (
                    <TextField {...params} size="small" label="Pessoa 2" fullWidth />
                  )}
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <TextField
                  size="small"
                  label="% pessoa 2"
                  type="number"
                  value={form.split_percent_2}
                  onChange={(e) => patch("split_percent_2", e.target.value)}
                  fullWidth
                />
              </Box>
            </>
          )}

          <Box sx={{ gridColumn: "1 / -1", mt: 0.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Projecao e parcelamento
            </Typography>
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <TextField
              select
              size="small"
              label="Tipo"
              value={form.automation_mode}
              onChange={(e) => patch("automation_mode", e.target.value)}
              fullWidth
            >
              <MenuItem value="single">Unica</MenuItem>
              <MenuItem value="installments">Parcelada mensal</MenuItem>
              <MenuItem value="recurring">Recorrente mensal</MenuItem>
            </TextField>
          </Box>

          {form.automation_mode !== "single" && (
            <>
              <Box sx={{ minWidth: 0 }}>
                <TextField
                  size="small"
                  label="Parcelas"
                  type="number"
                  value={form.repeat_count}
                  onChange={(e) => patch("repeat_count", e.target.value)}
                  fullWidth
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <TextField
                  size="small"
                  label="Ou repetir ate"
                  type="date"
                  value={form.repeat_until}
                  onChange={(e) => patch("repeat_until", e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            </>
          )}

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
