import { useMemo, useState } from "react";
import { Box, Button, Card, CardContent, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { brl, unique } from "../utils";
import TransactionsTable from "./TransactionsTable";

const colors = ["#1976d2", "#2e7d32", "#ed6c02", "#9c27b0", "#d32f2f", "#00897b", "#5d4037", "#455a64"];
const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function buildMonths(year) {
  return monthLabels.map((label, index) => ({
    key: `${year}-${String(index + 1).padStart(2, "0")}`,
    label,
  }));
}

function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function CategoryPie({ data, selectedCategory, onSelectCategory }) {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  let angle = 0;

  if (!total) {
    return (
      <Box sx={{ height: 180, display: "grid", placeItems: "center" }}>
        <Typography variant="body2" color="text.secondary">Sem dados para categorias.</Typography>
      </Box>
    );
  }

  const selected = data.find((item) => item.category === selectedCategory);
  const pct = (value) => `${(value / total * 100).toFixed(1)}%`;

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
      <Box component="svg" viewBox="0 0 200 200" sx={{ width: 180, height: 180, flex: "0 0 auto" }}>
        {data.length === 1 ? (
          <circle
            cx="100"
            cy="100"
            r="88"
            fill={colors[0]}
            onClick={() => onSelectCategory(selectedCategory === data[0].category ? "" : data[0].category)}
            style={{ cursor: "pointer" }}
          >
            <title>{`${data[0].category}: ${brl(data[0].signedValue)} (${pct(data[0].value)})`}</title>
          </circle>
        ) : (
          data.map((item, index) => {
            const slice = item.value / total * 360;
            const path = describeArc(100, 100, 88, angle, angle + slice);
            angle += slice;
            const isSelected = item.category === selectedCategory;
            return (
              <path
                key={item.category}
                d={path}
                fill={colors[index % colors.length]}
                stroke={isSelected ? "#111827" : "white"}
                strokeWidth={isSelected ? 3 : 1}
                opacity={selectedCategory && !isSelected ? 0.55 : 1}
                onClick={() => onSelectCategory(isSelected ? "" : item.category)}
                style={{ cursor: "pointer" }}
              >
                <title>{`${item.category}: ${brl(item.signedValue)} (${pct(item.value)})`}</title>
              </path>
            );
          })
        )}
        <circle cx="100" cy="100" r="42" fill="white" />
      </Box>

      <Stack spacing={0.75} sx={{ minWidth: 0, width: "100%" }}>
        {selected && (
          <Box sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2">{selected.category}</Typography>
            <Typography
              variant="body2"
              fontWeight={700}
              color={selected.signedValue < 0 ? "error.main" : "success.main"}
            >
              {brl(selected.signedValue)} - {pct(selected.value)}
            </Typography>
          </Box>
        )}
        {data.map((item, index) => (
          <Box
            key={item.category}
            onClick={() => onSelectCategory(selectedCategory === item.category ? "" : item.category)}
            sx={{
              display: "grid",
              gridTemplateColumns: "12px minmax(0, 1fr) auto auto",
              alignItems: "center",
              gap: 1,
              cursor: "pointer",
              opacity: selectedCategory && selectedCategory !== item.category ? 0.6 : 1,
              px: 0.5,
              py: 0.25,
              borderRadius: 1,
              bgcolor: selectedCategory === item.category ? "action.selected" : "transparent",
            }}
          >
            <Box sx={{ width: 12, height: 12, bgcolor: colors[index % colors.length], borderRadius: "50%" }} />
            <Typography variant="body2" noWrap>{item.category}</Typography>
            <Typography variant="body2" color="text.secondary">{pct(item.value)}</Typography>
            <Typography
              variant="body2"
              fontWeight={600}
              color={item.signedValue < 0 ? "error.main" : "success.main"}
            >
              {brl(item.signedValue)}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

function MonthlyBars({ data, selectedMonth, onSelectMonth }) {
  const width = 760;
  const height = 260;
  const chartTop = 20;
  const chartBottom = 210;
  const baseline = chartBottom;
  const maxValue = Math.max(...data.flatMap((item) => [item.income, item.outcome]), 1);
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
          const incomeHeight = scale(item.income);
          const outcomeHeight = scale(item.outcome);
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
                y={baseline - incomeHeight}
                width={barWidth}
                height={incomeHeight}
                rx="3"
                fill="#2e7d32"
              >
                <title>{`${item.label} entradas: ${brl(item.income)}`}</title>
              </rect>
              <rect
                x={x + 2}
                y={baseline - outcomeHeight}
                width={barWidth}
                height={outcomeHeight}
                rx="3"
                fill="#d32f2f"
              >
                <title>{`${item.label} saidas: ${brl(-item.outcome)}`}</title>
              </rect>
              <text x={x} y="236" textAnchor="middle" fontSize="12" fill="#475569">{item.label}</text>
              <text x={x} y="252" textAnchor="middle" fontSize="11" fill={item.cumulative < 0 ? "#d32f2f" : "#2e7d32"}>
                {brl(item.cumulative)}
              </text>
            </g>
          );
        })}
      </Box>
      <Stack direction="row" spacing={2} sx={{ px: 1, mt: -1 }} alignItems="center">
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 10, height: 10, bgcolor: "success.main", borderRadius: "50%" }} />
          <Typography variant="caption">Entradas</Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 10, height: 10, bgcolor: "error.main", borderRadius: "50%" }} />
          <Typography variant="caption">Saidas</Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

function ForecastVsRealized({ data, selectedMonth, onSelectMonth }) {
  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(128px, 1fr))",
          gap: 1,
          minWidth: 1120,
        }}
      >
        {data.map((item) => {
          const isSelected = selectedMonth === item.month;
          return (
            <Box
              key={item.month}
              onClick={() => onSelectMonth(isSelected ? "" : item.month)}
              sx={{
                border: "1px solid",
                borderColor: isSelected ? "primary.main" : "divider",
                borderRadius: 1,
                p: 1,
                cursor: "pointer",
                bgcolor: isSelected ? "action.selected" : "background.paper",
              }}
            >
              <Typography variant="subtitle2" fontWeight={700}>{item.label}</Typography>
              <Typography variant="caption" color="text.secondary">Previsto acum.</Typography>
              <Typography variant="body2" fontWeight={700} color={item.projectedCumulative < 0 ? "error.main" : "success.main"}>
                {brl(item.projectedCumulative)}
              </Typography>
              <Typography variant="caption" color="text.secondary">Realizado acum.</Typography>
              <Typography variant="body2" fontWeight={700} color={item.realizedCumulative < 0 ? "error.main" : "success.main"}>
                {brl(item.realizedCumulative)}
              </Typography>
              <Typography variant="caption" color="text.secondary">Diferenca</Typography>
              <Typography variant="body2" fontWeight={700} color={item.diff < 0 ? "error.main" : "success.main"}>
                {brl(item.diff)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default function AnnualProjection({ items, owner, optionsVersion, profile, onSaved }) {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [filters, setFilters] = useState({
    month: "",
    category: "",
    bank: "",
    payment: "",
    status: "",
    q: "",
  });

  const months = useMemo(() => buildMonths(selectedYear), [selectedYear]);
  const yearStart = `${selectedYear}-01-01`;
  const yearEnd = `${selectedYear}-12-31`;

  const rows = useMemo(() => {
    return items
      .filter((item) => item.person === owner)
      .filter((item) => item.day >= yearStart && item.day <= yearEnd)
      .sort((a, b) => b.id - a.id);
  }, [items, owner, yearEnd, yearStart]);

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

  const projectedRows = useMemo(
    () => filteredRows.filter((item) => item.is_projected),
    [filteredRows]
  );
  const realizedRows = useMemo(
    () => filteredRows.filter((item) => !item.is_projected),
    [filteredRows]
  );

  const categoryData = useMemo(() => {
    const map = new Map();
    for (const item of realizedRows) {
      const category = item.category || "Sem categoria";
      const signedValue = Number(item.value || 0);
      const current = map.get(category) || { category, value: 0, signedValue: 0 };
      current.value += Math.abs(signedValue);
      current.signedValue += signedValue;
      map.set(category, current);
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [realizedRows]);

  const initialBalance = Number(profile?.initial_balance || 0);

  const monthlyData = useMemo(() => {
    let cumulative = initialBalance;
    return months.map((month) => {
      const monthRows = realizedRows.filter((item) => String(item.day || "").startsWith(month.key));
      const income = monthRows
        .filter((item) => Number(item.value || 0) > 0)
        .reduce((acc, item) => acc + Number(item.value || 0), 0);
      const outcome = Math.abs(monthRows
        .filter((item) => Number(item.value || 0) < 0)
        .reduce((acc, item) => acc + Number(item.value || 0), 0));
      const net = income - outcome;
      cumulative += net;
      return {
        month: month.key,
        label: month.label,
        income,
        outcome,
        net,
        cumulative,
      };
    });
  }, [initialBalance, months, realizedRows]);

  const forecastData = useMemo(() => {
    let projectedCumulative = initialBalance;
    let realizedCumulative = initialBalance;
    return months.map((month) => {
      const monthRows = filteredRows.filter((item) => String(item.day || "").startsWith(month.key));
      const projected = monthRows
        .filter((item) => item.is_projected)
        .reduce((acc, item) => acc + Number(item.value || 0), 0);
      const realized = monthRows
        .filter((item) => !item.is_projected)
        .reduce((acc, item) => acc + Number(item.value || 0), 0);
      projectedCumulative += projected;
      realizedCumulative += realized;
      return {
        month: month.key,
        label: month.label,
        projected,
        realized,
        projectedCumulative,
        realizedCumulative,
        diff: realizedCumulative - projectedCumulative,
      };
    });
  }, [initialBalance, filteredRows, months]);

  const filteredTotal = filteredRows.reduce((acc, item) => acc + Number(item.value || 0), 0);
  const projectedTotal = projectedRows.reduce((acc, item) => acc + Number(item.value || 0), 0);
  const realizedTotal = realizedRows.reduce((acc, item) => acc + Number(item.value || 0), 0);
  const patchFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () => setFilters({ month: "", category: "", bank: "", payment: "", status: "", q: "" });
  const changeYear = (year) => {
    setSelectedYear(year);
    clearFilters();
  };

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Tooltip title="Ano anterior">
                <IconButton size="small" onClick={() => changeYear(selectedYear - 1)} aria-label="Ver ano anterior">
                  <ChevronLeftIcon />
                </IconButton>
              </Tooltip>
              <Typography variant="h6" fontWeight={700}>{selectedYear}</Typography>
              <Tooltip title="Próximo ano">
                <IconButton size="small" onClick={() => changeYear(selectedYear + 1)} aria-label="Ver próximo ano">
                  <ChevronRightIcon />
                </IconButton>
              </Tooltip>
            </Stack>
            <Box>
              <Typography variant="subtitle2">Pessoa</Typography>
              <Typography variant="body1" fontWeight={700}>{owner}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Periodo</Typography>
              <Typography variant="body1" fontWeight={700}>01/01/{selectedYear} ate 31/12/{selectedYear}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Compromissos projetados</Typography>
              <Typography variant="h5" fontWeight={700} color={projectedTotal < 0 ? "error.main" : "success.main"}>
                {brl(projectedTotal)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Realizado no periodo</Typography>
              <Typography variant="h5" fontWeight={700} color={realizedTotal < 0 ? "error.main" : "success.main"}>
                {brl(realizedTotal)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Saldo realizado</Typography>
              <Typography variant="h5" fontWeight={700} color={initialBalance + realizedTotal < 0 ? "error.main" : "success.main"}>
                {brl(initialBalance + realizedTotal)}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Categorias realizadas</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            A seleção da categoria filtra todos os indicadores desta tela.
          </Typography>
          <CategoryPie
            data={categoryData}
            selectedCategory={filters.category}
            onSelectCategory={(category) => patchFilter("category", category)}
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
              <Typography variant="h6" fontWeight={700}>Previsto vs realizado</Typography>
              <Typography variant="body2" color="text.secondary">
                Comparativo acumulado dos registros previstos e realizados conforme os filtros selecionados.
              </Typography>
            </Box>
            {filters.month && (
              <Button size="small" variant="outlined" onClick={() => patchFilter("month", "")}>
                Limpar mes
              </Button>
            )}
          </Stack>
          <ForecastVsRealized
            data={forecastData}
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
            sx={{ mb: 1 }}
          >
            <Box>
              <Typography variant="h6" fontWeight={700}>Entradas e saidas realizadas por mes</Typography>
              <Typography variant="body2" color="text.secondary">
                Clique em um mes para filtrar todos os indicadores da tela.
              </Typography>
            </Box>
            {filters.month && (
              <Button size="small" variant="outlined" onClick={() => patchFilter("month", "")}>
                Limpar mes
              </Button>
            )}
          </Stack>
          <MonthlyBars
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
                {filteredRows.length} registros - Total {brl(filteredTotal)}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={clearFilters}
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
              <MenuItem value="projected">Projetadas</MenuItem>
              <MenuItem value="realized">Realizadas</MenuItem>
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
