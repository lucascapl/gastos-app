import { useEffect, useMemo, useState } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { api } from "../api";

const pad = (value) => String(value).padStart(2, "0");
const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthLastDay = (year, month) => new Date(year, month, 0).getDate();
const makeClosingDateFor = (year, month, day) => (
  new Date(year, month - 1, Math.min(day, monthLastDay(year, month)))
);

function addMonthsKeepDay(date, months) {
  const desired = date.getDate();
  const month = date.getMonth() + months + 1;
  const year = date.getFullYear() + Math.floor((month - 1) / 12);
  const monthIndex = ((month - 1) % 12 + 12) % 12;
  const last = monthLastDay(year, monthIndex + 1);
  return new Date(year, monthIndex, Math.min(desired, last));
}

function computeCycle(closingDay, year, month) {
  const start = makeClosingDateFor(year, month, closingDay);
  const nextStart = addMonthsKeepDay(start, 1);
  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);
  return { startISO: toISO(start), endISO: toISO(end) };
}

function buildMonthOptions(count = 24) {
  const now = new Date();
  const options = [];
  for (let index = 0; index < count; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    options.push({
      value: `${date.getFullYear()}-${pad(date.getMonth() + 1)}`,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
    });
  }
  return options;
}

const monthNames = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export default function BillingCycleBar({ onChange }) {
  const [banks, setBanks] = useState([]);
  const [bankName, setBankName] = useState("");
  const [month, setMonth] = useState("");
  const months = useMemo(() => buildMonthOptions(24), []);
  const selectedBank = banks.find((bank) => bank.name === bankName);
  const closingDay = Number(selectedBank?.closing_day || 0);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/profile");
        setBanks((data?.banks || []).filter((bank) => !bank.investments_only));
      } catch {
        setBanks([]);
      }
    })();
  }, []);

  const clearSelection = () => {
    setMonth("");
    onChange?.({ from: "", to: "", payment: "", bank: "" });
  };

  const applySelection = (monthValue) => {
    if (!monthValue || !bankName || !closingDay) {
      onChange?.({ from: "", to: "", payment: "", bank: bankName || "" });
      return;
    }

    const [year, selectedMonth] = monthValue.split("-").map(Number);
    const { startISO, endISO } = computeCycle(closingDay, year, selectedMonth);
    onChange?.({
      from: startISO,
      to: endISO,
      bank: bankName,
      payment: "Credito",
      meta: { closingDay },
    });
  };

  return (
    <Box sx={{ mt: 2, mb: 1 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="billing-bank-label">Banco</InputLabel>
          <Select
            labelId="billing-bank-label"
            label="Banco"
            value={bankName}
            onChange={(event) => {
              const nextBank = event.target.value;
              setBankName(nextBank);
              setMonth("");
              onChange?.({ from: "", to: "", payment: "", bank: nextBank || "" });
            }}
          >
            <MenuItem value=""><em>Selecione</em></MenuItem>
            {banks.map((bank) => (
              <MenuItem key={bank.id} value={bank.name}>{bank.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ minWidth: 180 }}>
          <Typography variant="caption" color="text.secondary">Fechamento</Typography>
          <Typography variant="body2" fontWeight={700}>
            {bankName
              ? (closingDay ? `Dia ${closingDay}` : "Nao cadastrado")
              : "Selecione um banco"}
          </Typography>
        </Box>

        <FormControl size="small" sx={{ minWidth: 220 }} disabled={!bankName || !closingDay}>
          <InputLabel id="billing-month-label">Ver fatura de</InputLabel>
          <Select
            labelId="billing-month-label"
            label="Ver fatura de"
            value={month}
            onChange={(event) => {
              const value = event.target.value;
              setMonth(value);
              if (!value) {
                clearSelection();
              } else {
                applySelection(value);
              }
            }}
          >
            <MenuItem value=""><em>Selecione</em></MenuItem>
            {months.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {`${monthNames[item.month - 1]} de ${item.year}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {bankName && !closingDay && (
          <Typography variant="body2" color="warning.main">
            Cadastre o fechamento em Edicao &gt; Bancos.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
