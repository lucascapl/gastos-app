import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { brl, unique } from "../utils";
import { api } from "../api";

const pad = (value) => String(value).padStart(2, "0");

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};

const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const monthLastDay = (year, month) => new Date(year, month, 0).getDate();

const makeClosingDateFor = (year, month, day) => (
  new Date(year, month - 1, Math.min(day, monthLastDay(year, month)))
);

function addMonthsKeepDay(date, months) {
  const desired = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth() + months + 1;
  const nextYear = year + Math.floor((month - 1) / 12);
  const nextMonthIndex = ((month - 1) % 12 + 12) % 12;
  const last = monthLastDay(nextYear, nextMonthIndex + 1);
  return new Date(nextYear, nextMonthIndex, Math.min(desired, last));
}

const billingCycleRange = (monthValue, closingDay) => {
  const [year, month] = String(monthValue || "").split("-").map(Number);
  if (!year || !month || !closingDay) return null;
  const start = makeClosingDateFor(year, month, closingDay);
  const nextStart = addMonthsKeepDay(start, 1);
  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);
  return { from: toISO(start), to: toISO(end) };
};

const monthRange = (monthValue) => {
  const [year, month] = String(monthValue || "").split("-").map(Number);
  if (!year || !month) return { from: "", to: "" };
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
};

const norm = (value) => String(value || "").trim().toLowerCase();

const downloadSummaryPng = ({ rows, total, person, bank, periodLabel }) => {
  const scale = 2;
  const width = 920;
  const rowHeight = 30;
  const tableTop = 220;
  const height = Math.max(360, tableTop + 48 + (rows.length || 1) * rowHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#111827";
  ctx.font = "700 30px Arial";
  ctx.fillText("Resumo de fatura", 36, 52);

  ctx.font = "400 15px Arial";
  ctx.fillStyle = "#4b5563";
  ctx.fillText(`Pessoa: ${person || "Todas"}`, 36, 88);
  ctx.fillText(`Banco: ${bank || "Todos"}`, 36, 114);
  ctx.fillText(`Periodo: ${periodLabel}`, 36, 140);

  ctx.fillStyle = total < 0 ? "#b91c1c" : "#15803d";
  ctx.font = "700 34px Arial";
  ctx.fillText(brl(total), 36, 188);

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, 206);
  ctx.lineTo(width - 36, 206);
  ctx.stroke();

  ctx.fillStyle = "#111827";
  ctx.font = "700 14px Arial";
  ctx.fillText("Data", 36, tableTop);
  ctx.fillText("Evento", 150, tableTop);
  ctx.fillText("Categoria", 560, tableTop);
  ctx.textAlign = "right";
  ctx.fillText("Valor", width - 36, tableTop);
  ctx.textAlign = "left";

  ctx.font = "400 14px Arial";
  rows.forEach((row, index) => {
    const y = tableTop + 30 + index * rowHeight;
    ctx.fillStyle = index % 2 ? "#ffffff" : "#f9fafb";
    ctx.fillRect(28, y - 21, width - 56, rowHeight);
    ctx.fillStyle = "#111827";
    ctx.fillText(row.day || "-", 36, y);
    ctx.fillText(String(row.event || "-").slice(0, 52), 150, y);
    ctx.fillText(String(row.category || "Sem categoria").slice(0, 28), 560, y);
    ctx.textAlign = "right";
    ctx.fillStyle = Number(row.value || 0) < 0 ? "#b91c1c" : "#15803d";
    ctx.fillText(brl(row.value), width - 36, y);
    ctx.textAlign = "left";
  });

  if (!rows.length) {
    ctx.fillStyle = "#6b7280";
    ctx.fillText("Nenhuma transacao encontrada para os filtros.", 36, tableTop + 34);
  }

  const link = document.createElement("a");
  link.download = `resumo-fatura-${bank || "todos"}-${person || "todos"}.png`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .toLowerCase();
  link.href = canvas.toDataURL("image/png");
  link.click();
};

export default function InvoiceSummary({ items = [] }) {
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(currentMonth);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [person, setPerson] = useState("");
  const [bank, setBank] = useState("");
  const [profileBanks, setProfileBanks] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/profile");
        setProfileBanks(data.banks || []);
      } catch {
        setProfileBanks([]);
      }
    })();
  }, []);

  const people = useMemo(() => unique(items.map((item) => item.person)), [items]);
  const banks = useMemo(() => unique(items.map((item) => item.bank)), [items]);
  const closingDayByBank = useMemo(() => {
    const map = new Map();
    profileBanks.forEach((profileBank) => {
      map.set(norm(profileBank.name), Number(profileBank.closing_day || 0));
    });
    return map;
  }, [profileBanks]);
  const selectedClosingDay = bank ? closingDayByBank.get(norm(bank)) || 0 : 0;

  const range = mode === "month" && bank
    ? (billingCycleRange(month, selectedClosingDay) || monthRange(month))
    : mode === "month"
      ? monthRange(month)
    : { from, to };
  const periodLabel = mode === "month" && !bank
    ? `${month} (fechamento de cada banco quando cadastrado)`
    : `${range.from || "-"} ate ${range.to || "-"}`;

  const rows = useMemo(() => {
    return items
      .filter((item) => {
        if (norm(item.payment) !== "credito") return false;
        if (person && item.person !== person) return false;
        if (bank && item.bank !== bank) return false;
        const itemRange = mode === "month" && !bank
          ? (billingCycleRange(month, closingDayByBank.get(norm(item.bank)) || 0) || monthRange(month))
          : range;
        if (itemRange.from && item.day < itemRange.from) return false;
        if (itemRange.to && item.day > itemRange.to) return false;
        return true;
      })
      .sort((a, b) => a.day.localeCompare(b.day) || a.id - b.id);
  }, [bank, closingDayByBank, items, mode, month, person, range]);

  const total = rows.reduce((acc, row) => acc + Number(row.value || 0), 0);

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h4" fontWeight={700}>Resumo de fatura</Typography>
        <Typography variant="body2" color="text.secondary">
          Selecione pessoa, banco e periodo para calcular o total no credito.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "1fr 1fr",
                md: "1fr 1fr 1fr",
              },
            }}
          >
            <TextField
              size="small"
              select
              label="Pessoa"
              value={person}
              onChange={(event) => setPerson(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Todas</MenuItem>
              {people.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
            </TextField>

            <TextField
              size="small"
              select
              label="Banco"
              value={bank}
              onChange={(event) => setBank(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Todos</MenuItem>
              {banks.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
            </TextField>

            <RadioGroup
              row
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              sx={{ alignItems: "center" }}
            >
              <FormControlLabel value="month" control={<Radio size="small" />} label="Mes" />
              <FormControlLabel value="range" control={<Radio size="small" />} label="Range" />
            </RadioGroup>

            {mode === "month" ? (
              <TextField
                size="small"
                type="month"
                label="Mes da fatura"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText={
                  bank
                    ? (selectedClosingDay ? `Usando fechamento dia ${selectedClosingDay}` : "Banco sem fechamento cadastrado: mes calendario")
                    : "Todos: cada banco usa seu fechamento cadastrado"
                }
                fullWidth
              />
            ) : (
              <>
                <TextField
                  size="small"
                  type="date"
                  label="De"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  size="small"
                  type="date"
                  label="Ate"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </>
            )}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            gap={1}
          >
            <Box>
              <Typography variant="subtitle2">Pessoa</Typography>
              <Typography variant="body2" color="text.secondary">
                {person || "Todas"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Banco</Typography>
              <Typography variant="body2" color="text.secondary">
                {bank || "Todos"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Periodo</Typography>
              <Typography variant="body2" color="text.secondary">
                {periodLabel}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Valor total</Typography>
              <Typography variant="h5" fontWeight={700} color={total < 0 ? "error.main" : "success.main"}>
                {brl(total)}
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="outlined"
            size="small"
            sx={{ mt: 2 }}
            onClick={() => downloadSummaryPng({ rows, total, person, bank, periodLabel })}
          >
            Exportar PNG
          </Button>

          <Divider sx={{ my: 2 }} />

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data</TableCell>
                  <TableCell>Evento</TableCell>
                  <TableCell>Categoria</TableCell>
                  <TableCell align="right">Valor</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.day}</TableCell>
                    <TableCell>{row.event}</TableCell>
                    <TableCell>{row.category || "Sem categoria"}</TableCell>
                    <TableCell align="right">{brl(row.value)}</TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography variant="body2" color="text.secondary">
                        Nenhuma transacao encontrada para os filtros.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Stack>
  );
}
