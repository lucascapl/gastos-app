import { useMemo, useState } from "react";
import { Box, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { brl, unique } from "../utils";
import TransactionsTable from "./TransactionsTable";

const year = 2026;
const months = [
  { key: `${year}-01`, label: "Jan" },
  { key: `${year}-02`, label: "Fev" },
  { key: `${year}-03`, label: "Mar" },
  { key: `${year}-04`, label: "Abr" },
  { key: `${year}-05`, label: "Mai" },
  { key: `${year}-06`, label: "Jun" },
  { key: `${year}-07`, label: "Jul" },
  { key: `${year}-08`, label: "Ago" },
  { key: `${year}-09`, label: "Set" },
  { key: `${year}-10`, label: "Out" },
  { key: `${year}-11`, label: "Nov" },
  { key: `${year}-12`, label: "Dez" },
];

const norm = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

const isInvestmentCategory = (category) => {
  const normalized = norm(category);
  return normalized.includes("invest") || normalized.includes("resgat");
};

function InvestmentBars({ data, selectedMonth, onSelectMonth }) {
  const width = 760;
  const height = 260;
  const chartTop = 20;
  const chartBottom = 210;
  const baseline = chartBottom;
  const maxValue = Math.max(...data.flatMap((item) => [item.applied, item.withdrawn]), 1);
  const scale = (value) => value / maxValue * (chartBottom - chartTop);
  const groupWidth = width / data.length;
  const barWidth = 12;

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <Box
        component="svg"
        viewBox={`0 0 ${width} ${height}`}
        sx={{ minWidth: 680, width: "100%", height: 280 }}
      >
        <line x1="24" x2={width - 16} y1={baseline} y2={baseline} stroke="#d0d7de" />
        {data.map((item, index) => {
          const x = index * groupWidth + groupWidth / 2;
          const appliedHeight = scale(item.applied);
          const withdrawnHeight = scale(item.withdrawn);
          const isSelected = selectedMonth === item.month;

          return (
            <g
              key={item.month}
              onClick={() => onSelectMonth(isSelected ? "" : item.month)}
              style={{ cursor: "pointer" }}
              opacity={selectedMonth && !isSelected ? 0.45 : 1}
            >
              {isSelected && (
                <rect
                  x={index * groupWidth + 4}
                  y={8}
                  width={groupWidth - 8}
                  height={222}
                  rx="6"
                  fill="#f1f5f9"
                />
              )}
              <rect
                x={x - barWidth - 2}
                y={baseline - appliedHeight}
                width={barWidth}
                height={appliedHeight}
                rx="3"
                fill="#1976d2"
              >
                <title>{`${item.label} aplicado: ${brl(item.applied)}`}</title>
              </rect>
              <rect
                x={x + 2}
                y={baseline - withdrawnHeight}
                width={barWidth}
                height={withdrawnHeight}
                rx="3"
                fill="#d32f2f"
              >
                <title>{`${item.label} resgatado: ${brl(item.withdrawn)}`}</title>
              </rect>
              <text x={x} y="236" textAnchor="middle" fontSize="12" fill="#475569">{item.label}</text>
              <text x={x} y="252" textAnchor="middle" fontSize="11" fill={item.net < 0 ? "#d32f2f" : "#1976d2"}>
                {brl(item.net)}
              </text>
            </g>
          );
        })}
      </Box>
      <Stack direction="row" spacing={2} sx={{ px: 1, mt: -1 }} alignItems="center">
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 10, height: 10, bgcolor: "primary.main", borderRadius: "50%" }} />
          <Typography variant="caption">Aplicado</Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 10, height: 10, bgcolor: "error.main", borderRadius: "50%" }} />
          <Typography variant="caption">Resgatado</Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

export default function InvestmentsView({ items, owner, optionsVersion, onSaved }) {
  const [filters, setFilters] = useState({
    month: "",
    category: "",
    bank: "",
    payment: "",
    status: "realized",
    q: "",
  });

  const rows = useMemo(() => {
    return items
      .filter((item) => item.person === owner)
      .filter((item) => isInvestmentCategory(item.category))
      .filter((item) => item.day >= `${year}-01-01` && item.day <= `${year}-12-31`)
      .sort((a, b) => b.id - a.id);
  }, [items, owner]);

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      if (filters.month && !String(item.day || "").startsWith(filters.month)) return false;
      if (filters.category && item.category !== filters.category) return false;
      if (filters.bank && item.bank !== filters.bank) return false;
      if (filters.payment && item.payment !== filters.payment) return false;
      if (filters.status === "projected" && !item.is_projected) return false;
      if (filters.status === "realized" && item.is_projected) return false;
      if (filters.q && !String(item.event || "").toLowerCase().includes(filters.q.toLowerCase())) return false;
      return true;
    });
  }, [filters, rows]);

  const categories = useMemo(() => unique(rows.map((item) => item.category)), [rows]);
  const banks = useMemo(() => unique(rows.map((item) => item.bank)), [rows]);
  const payments = useMemo(() => unique(rows.map((item) => item.payment)), [rows]);

  const applied = filteredRows
    .filter((item) => Number(item.value || 0) < 0)
    .reduce((acc, item) => acc + Math.abs(Number(item.value || 0)), 0);
  const withdrawn = filteredRows
    .filter((item) => Number(item.value || 0) > 0)
    .reduce((acc, item) => acc + Number(item.value || 0), 0);
  const investedBalance = applied - withdrawn;

  const bankSummary = useMemo(() => {
    const totals = new Map();

    for (const item of filteredRows) {
      const bank = item.bank || "Sem banco";
      const value = Number(item.value || 0);
      const current = totals.get(bank) || { bank, applied: 0, withdrawn: 0 };

      if (value < 0) current.applied += Math.abs(value);
      if (value > 0) current.withdrawn += value;

      totals.set(bank, current);
    }

    return Array.from(totals.values())
      .map((item) => ({
        ...item,
        balance: item.applied - item.withdrawn,
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [filteredRows]);

  const monthlyData = useMemo(() => {
    return months.map((month) => {
      const monthRows = rows
        .filter((item) => String(item.day || "").startsWith(month.key))
        .filter((item) => {
          if (filters.status === "projected" && !item.is_projected) return false;
          if (filters.status === "realized" && item.is_projected) return false;
          return true;
        });
      const monthApplied = monthRows
        .filter((item) => Number(item.value || 0) < 0)
        .reduce((acc, item) => acc + Math.abs(Number(item.value || 0)), 0);
      const monthWithdrawn = monthRows
        .filter((item) => Number(item.value || 0) > 0)
        .reduce((acc, item) => acc + Number(item.value || 0), 0);

      return {
        month: month.key,
        label: month.label,
        applied: monthApplied,
        withdrawn: monthWithdrawn,
        net: monthApplied - monthWithdrawn,
      };
    });
  }, [filters.status, rows]);

  const patchFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="subtitle2">Montante aplicado</Typography>
              <Typography variant="h5" fontWeight={700} color="primary.main">{brl(applied)}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Valor retirado</Typography>
              <Typography variant="h5" fontWeight={700} color="error.main">{brl(withdrawn)}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Saldo investido</Typography>
              <Typography variant="h5" fontWeight={700} color={investedBalance < 0 ? "error.main" : "success.main"}>
                {brl(investedBalance)}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            gap={1}
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography variant="h6" fontWeight={700}>Montante por banco</Typography>
              <Typography variant="body2" color="text.secondary">
                Aplicado menos retirado, considerando os filtros atuais.
              </Typography>
            </Box>
          </Stack>

          {bankSummary.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhum investimento encontrado para os filtros atuais.
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                },
              }}
            >
              {bankSummary.map((item) => (
                <Box
                  key={item.bank}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    p: 1.25,
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    gap={0.75}
                  >
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>{item.bank}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Aplicado {brl(item.applied)} / Retirado {brl(item.withdrawn)}
                      </Typography>
                    </Box>
                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      color={item.balance < 0 ? "error.main" : "success.main"}
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      {brl(item.balance)}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            gap={1}
            sx={{ mb: 1 }}
          >
            <Box>
              <Typography variant="h6" fontWeight={700}>Aplicacoes e resgates por mes</Typography>
              <Typography variant="body2" color="text.secondary">
                Clique em um mes para filtrar a tabela.
              </Typography>
            </Box>
            {filters.month && (
              <Button size="small" variant="outlined" onClick={() => patchFilter("month", "")}>
                Limpar mes
              </Button>
            )}
          </Stack>
          <InvestmentBars
            data={monthlyData}
            selectedMonth={filters.month}
            onSelectMonth={(month) => patchFilter("month", month)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            gap={1}
            sx={{ mb: 2 }}
          >
            <Box>
              <Typography variant="h6" fontWeight={700}>Transacoes</Typography>
              <Typography variant="body2" color="text.secondary">
                {filteredRows.length} registros
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setFilters({ month: "", category: "", bank: "", payment: "", status: "realized", q: "" })}
            >
              Limpar filtros
            </Button>
          </Stack>
          <Box
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
            <TextField
              select
              size="small"
              label="Mes"
              value={filters.month}
              onChange={(event) => patchFilter("month", event.target.value)}
              fullWidth
            >
              <MenuItem value="">Todos</MenuItem>
              {months.map((month) => <MenuItem key={month.key} value={month.key}>{month.label}</MenuItem>)}
            </TextField>
            <TextField
              select
              size="small"
              label="Categoria"
              value={filters.category}
              onChange={(event) => patchFilter("category", event.target.value)}
              fullWidth
            >
              <MenuItem value="">Todas</MenuItem>
              {categories.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
            </TextField>
            <TextField
              select
              size="small"
              label="Banco"
              value={filters.bank}
              onChange={(event) => patchFilter("bank", event.target.value)}
              fullWidth
            >
              <MenuItem value="">Todos</MenuItem>
              {banks.map((bank) => <MenuItem key={bank} value={bank}>{bank}</MenuItem>)}
            </TextField>
            <TextField
              select
              size="small"
              label="Pagamento"
              value={filters.payment}
              onChange={(event) => patchFilter("payment", event.target.value)}
              fullWidth
            >
              <MenuItem value="">Todos</MenuItem>
              {payments.map((payment) => <MenuItem key={payment} value={payment}>{payment}</MenuItem>)}
            </TextField>
            <TextField
              select
              size="small"
              label="Status"
              value={filters.status}
              onChange={(event) => patchFilter("status", event.target.value)}
              fullWidth
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="realized">Realizadas</MenuItem>
              <MenuItem value="projected">Projetadas</MenuItem>
            </TextField>
            <TextField
              size="small"
              label="Buscar evento"
              value={filters.q}
              onChange={(event) => patchFilter("q", event.target.value)}
              fullWidth
            />
          </Box>
        </CardContent>
      </Card>

      <TransactionsTable
        items={filteredRows}
        optionsVersion={optionsVersion}
        onSaved={onSaved}
      />
    </Stack>
  );
}
