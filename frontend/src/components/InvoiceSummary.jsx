import { useMemo, useState } from "react";
import {
  Box,
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

const pad = (value) => String(value).padStart(2, "0");
const BILLING_CLOSING_DAY_COOKIE = "billingClosingDay";

function getCookie(name) {
  const key = `${name}=`;
  const hit = document.cookie.split(";").map(c => c.trim()).find(c => c.startsWith(key));
  return hit ? decodeURIComponent(hit.substring(key.length)) : null;
}

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

export default function InvoiceSummary({ items = [] }) {
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(currentMonth);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [person, setPerson] = useState("");
  const [bank, setBank] = useState("");

  const people = useMemo(() => unique(items.map((item) => item.person)), [items]);
  const banks = useMemo(() => unique(items.map((item) => item.bank)), [items]);
  const closingDay = Number(getCookie(BILLING_CLOSING_DAY_COOKIE) || 0);

  const range = mode === "month"
    ? (billingCycleRange(month, closingDay) || monthRange(month))
    : { from, to };

  const rows = useMemo(() => {
    return items
      .filter((item) => {
        if (norm(item.payment) !== "credito") return false;
        if (person && item.person !== person) return false;
        if (bank && item.bank !== bank) return false;
        if (range.from && item.day < range.from) return false;
        if (range.to && item.day > range.to) return false;
        return true;
      })
      .sort((a, b) => a.day.localeCompare(b.day) || a.id - b.id);
  }, [bank, items, person, range.from, range.to]);

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
                helperText={closingDay ? `Usando fechamento dia ${closingDay}` : "Sem fechamento cadastrado: mes calendario"}
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
                {range.from || "-"} ate {range.to || "-"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Valor total</Typography>
              <Typography variant="h5" fontWeight={700} color={total < 0 ? "error.main" : "success.main"}>
                {brl(total)}
              </Typography>
            </Box>
          </Stack>

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
