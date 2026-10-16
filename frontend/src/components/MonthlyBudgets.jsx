import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Swal from "sweetalert2";
import { api } from "../api";
import { brl } from "../utils";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const emptyDraft = { categoryId: "", amount: "" };

function defaultMonthForYear(year) {
  const current = new Date();
  return year === current.getFullYear() ? current.getMonth() + 1 : 1;
}

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.response?.data?.error || fallback;
}

function normalizeAmount(value) {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return null;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function amountForInput(amount) {
  return Number(amount ?? 0).toFixed(2).replace(".", ",");
}

export default function MonthlyBudgets({ year, dataVersion = 0 }) {
  const [monthSelection, setMonthSelection] = useState(() => ({
    year,
    month: defaultMonthForYear(year),
  }));
  const month = monthSelection.year === year
    ? monthSelection.month
    : defaultMonthForYear(year);
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [summaryItems, setSummaryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    setMonthSelection((current) => (
      current.year === year ? current : { year, month }
    ));
  }, [month, year]);

  useEffect(() => {
    let active = true;

    api
      .get("/transactions/reference-data")
      .then(({ data }) => {
        if (active) setCategories(data.categories ?? []);
      })
      .catch(() => {
        if (active) setLoadError("Não foi possível carregar as categorias.");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    let active = true;

    async function loadBudgets() {
      setLoading(true);
      setLoadError("");
      setBudgets([]);
      setSummaryItems([]);

      try {
        const params = { year, month };
        const [budgetsResponse, summaryResponse] = await Promise.all([
          api.get("/budgets", { params }),
          api.get("/budgets/summary", { params }),
        ]);

        if (!active || id !== requestId.current) return;
        setBudgets(budgetsResponse.data.items ?? []);
        setSummaryItems(summaryResponse.data.items ?? []);
      } catch (error) {
        if (!active || id !== requestId.current) return;
        setLoadError(errorMessage(error, "Não foi possível carregar os orçamentos."));
      } finally {
        if (active && id === requestId.current) setLoading(false);
      }
    }

    loadBudgets();
    return () => {
      active = false;
    };
  }, [dataVersion, year, month, refreshKey]);

  const budgetedCategoryIds = useMemo(
    () => new Set(budgets.map((budget) => Number(budget.category?.id ?? budget.category_id))),
    [budgets],
  );
  const totals = useMemo(
    () =>
      summaryItems.reduce(
        (acc, item) => ({
          planned: acc.planned + Number(item.planned ?? item.amount ?? 0),
          actual: acc.actual + Number(item.actual ?? 0),
          remaining: acc.remaining + Number(item.remaining ?? 0),
        }),
        { planned: 0, actual: 0, remaining: 0 },
      ),
    [summaryItems],
  );

  function openCreateDialog() {
    setEditingBudget(null);
    setDraft(emptyDraft);
    setFormError("");
    setDialogOpen(true);
  }

  function openEditDialog(item) {
    setEditingBudget(item);
    setDraft({
      categoryId: String(item.category?.id ?? item.category_id),
      amount: amountForInput(item.planned ?? item.amount),
    });
    setFormError("");
    setDialogOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setDialogOpen(false);
  }

  async function saveBudget() {
    const amount = normalizeAmount(draft.amount);
    const categoryId = Number(draft.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      setFormError("Selecione uma categoria.");
      return;
    }
    if (amount === null) {
      setFormError("Informe um valor maior que zero, com no máximo duas casas decimais.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      if (editingBudget) {
        await api.patch(`/budgets/${editingBudget.id}`, {
          category_id: categoryId,
          amount,
        });
      } else {
        await api.post("/budgets", {
          category_id: categoryId,
          amount,
          year,
          month,
        });
      }
      setDialogOpen(false);
      setRefreshKey((key) => key + 1);
      void Swal.fire({
        title: editingBudget ? "Orçamento atualizado!" : "Orçamento criado!",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      if (error?.response?.status === 409) {
        setFormError("Já existe um orçamento para esta categoria neste período.");
      } else {
        setFormError(errorMessage(error, "Não foi possível salvar o orçamento."));
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteBudget(item) {
    const result = await Swal.fire({
      title: "Excluir orçamento?",
      text: `O orçamento de ${item.category?.name ?? "categoria"} para ${MONTHS[month - 1]} de ${year} será removido. As despesas reais não serão alteradas.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Excluir orçamento",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/budgets/${item.id}`);
      setRefreshKey((key) => key + 1);
      void Swal.fire({
        title: "Orçamento excluído!",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      await Swal.fire({
        title: "Não foi possível excluir",
        text: errorMessage(error, "Tente novamente."),
        icon: "error",
      });
    }
  }

  return (
    <Stack spacing={2.5}>
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={2}
          >
            <Box>
              <Typography variant="h6">Orçamentos mensais</Typography>
              <Typography variant="body2" color="text.secondary">
                Planeje por categoria. Entradas positivas na mesma categoria reduzem o realizado líquido.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                select
                size="small"
                label="Mês"
                value={month}
                onChange={(event) => setMonthSelection({ year, month: Number(event.target.value) })}
                sx={{ minWidth: 145 }}
              >
                {MONTHS.map((label, index) => (
                  <MenuItem key={label} value={index + 1}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
                Novo orçamento
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {loadError && <Alert severity="error">{loadError}</Alert>}

      {loading ? (
        <Stack alignItems="center" sx={{ py: 5 }}>
          <CircularProgress size={30} />
        </Stack>
      ) : (
        <>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            {[
              ["Planejado", brl(totals.planned)],
              ["Realizado líquido em categorias orçadas", brl(totals.actual)],
              [totals.remaining < 0 ? "Excedido" : "Restante", brl(Math.abs(totals.remaining))],
            ].map(([label, value]) => (
              <Card key={label} variant="outlined" sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                  <Typography variant="h6" color={label === "Excedido" ? "error.main" : "text.primary"}>{value}</Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>

          {summaryItems.length === 0 ? (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6">Nenhum orçamento neste período</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Cadastre um orçamento para {MONTHS[month - 1].toLowerCase()} de {year}. Isso não altera suas transações ou o saldo financeiro.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Stack spacing={1.5}>
              {summaryItems.map((item) => {
                const usage = Number(item.usage_percent ?? 0);
                const progressValue = Math.min(100, Math.max(0, usage));
                const overBudget = item.over_budget || Number(item.remaining) < 0;
                return (
                  <Card key={item.id} variant="outlined">
                    <CardContent>
                      <Stack spacing={1.25}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="h6">{item.category?.name ?? "Categoria removida"}</Typography>
                              {overBudget && <Chip label="Acima do orçamento" size="small" color="error" />}
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              Planejado {brl(item.planned ?? item.amount)} · Despesas {brl(item.gross_actual)} · Devoluções {brl(item.reimbursements)}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.5}>
                            <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEditDialog(item)}>Editar</Button>
                            <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => deleteBudget(item)}>Excluir</Button>
                          </Stack>
                        </Stack>
                        <LinearProgress color={overBudget ? "error" : "primary"} variant="determinate" value={progressValue} />
                        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={0.5}>
                          <Typography variant="body2" color={overBudget ? "error.main" : "text.secondary"}>
                            {overBudget ? `Excedido em ${brl(Math.abs(Number(item.remaining)))}` : `Restante: ${brl(item.remaining)}`}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">{usage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% utilizado</Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>{editingBudget ? "Editar orçamento" : "Novo orçamento"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Período: {MONTHS[month - 1]} de {year}
            </Typography>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              select
              required
              label="Categoria"
              value={draft.categoryId}
              onChange={(event) => setDraft((current) => ({ ...current, categoryId: event.target.value }))}
              disabled={saving}
              fullWidth
            >
              {categories.map((category) => {
                const isCurrent = Number(draft.categoryId) === Number(category.id);
                const alreadyBudgeted = budgetedCategoryIds.has(Number(category.id));
                return (
                  <MenuItem key={category.id} value={String(category.id)} disabled={alreadyBudgeted && !isCurrent}>
                    {category.name}
                  </MenuItem>
                );
              })}
            </TextField>
            <TextField
              required
              label="Valor planejado"
              value={draft.amount}
              onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
              placeholder="0,00"
              inputMode="decimal"
              disabled={saving}
              fullWidth
              helperText="Use vírgula ou ponto, com até duas casas decimais."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={saveBudget} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
