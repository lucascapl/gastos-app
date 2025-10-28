// src/components/BillingCycleBar.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Box, Stack, TextField, IconButton,
  FormControl, InputLabel, Select, MenuItem, Tooltip
} from "@mui/material";
import { Lock, LockOpen } from "@mui/icons-material";

/* ==================== Cookies ==================== */
const COOKIE_NAME = "billingClosingDay";
function setCookie(name, value, days = 365) {
  const d = new Date(); d.setTime(d.getTime() + days*24*60*60*1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/`;
}
function getCookie(name) {
  const key = `${name}=`;
  const hit = document.cookie.split(";").map(c=>c.trim()).find(c=>c.startsWith(key));
  return hit ? decodeURIComponent(hit.substring(key.length)) : null;
}

/* ==================== Date helpers ==================== */
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const monthLastDay = (y,m)=> new Date(y,m,0).getDate();
const makeClosingDateFor = (y,m,day)=> new Date(y, m-1, Math.min(day, monthLastDay(y,m)));
function addMonthsKeepDay(d, months) {
  const desired = d.getDate();
  const y = d.getFullYear(), m = d.getMonth() + months + 1;
  const ny = y + Math.floor((m-1)/12);
  const nm = ((m-1)%12 + 12) % 12;
  const last = monthLastDay(ny, nm+1);
  return new Date(ny, nm, Math.min(desired, last));
}
function computeCycle(closingDay, year, month /*1-12*/) {
  const start = makeClosingDateFor(year, month, closingDay);
  const nextStart = addMonthsKeepDay(start, 1);
  const end = new Date(nextStart); end.setDate(end.getDate()-1);
  return { startISO: toISO(start), endISO: toISO(end) };
}
function buildMonthOptions(count = 24) {
  const now = new Date(), arr = [];
  for (let i=0;i<count;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    arr.push({ value: `${d.getFullYear()}-${pad(d.getMonth()+1)}`, year: d.getFullYear(), month: d.getMonth()+1 });
  }
  return arr;
}
const monthNames = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

/* ==================== Component ==================== */
export default function BillingCycleBar({ defaultLocked=false, onChange }) {
  const [closingDate, setClosingDate] = useState("");  // "YYYY-MM-DD"
  const [locked, setLocked] = useState(defaultLocked);
  const [month, setMonth] = useState("");              // "" = Selecionado nenhum; senão "YYYY-MM"
  const months = useMemo(() => buildMonthOptions(24), []);
  const cookieClosingDay = getCookie(COOKIE_NAME);

  // Pré-preenche a data a partir do cookie (somente o dia) no mês atual.
  useEffect(() => {
    const now = new Date();
    const dayFromCookie = cookieClosingDay ? Number(cookieClosingDay) : null;
    if (dayFromCookie && !closingDate) {
      const d = makeClosingDateFor(now.getFullYear(), now.getMonth()+1, dayFromCookie);
      setClosingDate(toISO(d));
      setLocked(true); // opcional: já começar travado quando há cookie
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closingDay = useMemo(() => {
    if (closingDate) {
      const d = new Date(closingDate + "T00:00:00");
      return d.getDate();
    }
    return cookieClosingDay ? Number(cookieClosingDay) : null;
  }, [closingDate, cookieClosingDay]);

  const handleLockToggle = () => setLocked(x => !x);

  const applySelection = (mValue) => {
    if (!closingDay) return;
    if (!mValue) {
      // “Selecione”: limpar filtros
      onChange?.({ from: undefined, to: undefined, payment: undefined, meta: { label: "Sem filtro de fatura" } });
      return;
    }
    const [y, m] = mValue.split("-").map(Number);
    const { startISO, endISO } = computeCycle(closingDay, y, m);
    onChange?.({
      from: startISO,
      to: endISO,
      payment: "Credito", // sempre crédito quando um mês é escolhido
      meta: { label: `Ciclo ${pad(m)}/${y} (${startISO} → ${endISO})`, closingDay }
    });
  };

  return (
    <Box sx={{ mt:2, mb:1 }}>
      <Stack direction={{ xs:"column", sm:"row" }} spacing={2} alignItems="center">
        {/* Fechamento (salva APENAS o dia no cookie) */}
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="Fechamento da fatura"
            type="date"
            value={closingDate}
            onChange={(e) => {
              const v = e.target.value; setClosingDate(v); setMonth("");
              if (v) {
                const d = new Date(v + "T00:00:00");
                setCookie(COOKIE_NAME, String(d.getDate()), 365);
              }
              // ao mudar o fechamento, também limpamos o filtro atual
              onChange?.({ from: undefined, to: undefined, payment: undefined });
            }}
            InputLabelProps={{ shrink: true }}
            size="small"
            disabled={locked && !!closingDate}
          />
          <Tooltip title={locked ? "Destravar edição" : "Travar fechamento"}>
            <span>
              <IconButton onClick={handleLockToggle} disabled={!closingDay} size="small">
                {locked && closingDay ? <Lock /> : <LockOpen />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        {/* Select de mês (com opção 'Selecione') */}
        {locked && closingDay && (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="billing-month-label">Ver fatura de</InputLabel>
            <Select
              labelId="billing-month-label"
              label="Ver fatura de"
              value={month}
              onChange={(e) => {
                const v = e.target.value;
                setMonth(v);
                applySelection(v);
              }}
            >
              <MenuItem value=""><em>Selecione</em></MenuItem>
              {months.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {`${monthNames[m.month-1]} de ${m.year}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Stack>
    </Box>
  );
}
