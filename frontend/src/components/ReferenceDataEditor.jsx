import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import Swal from "sweetalert2";
import { api } from "../api";

const EDITABLE_GROUPS = [
  { key: "categories", label: "Categorias" },
  { key: "banks", label: "Bancos" },
  { key: "people", label: "Pessoas" },
  { key: "payment_methods", label: "Pagamentos" },
];

export default function ReferenceDataEditor({ onChanged }) {
  const [activeTab, setActiveTab] = useState("categories");
  const [data, setData] = useState({ categories: [], banks: [], people: [], payment_methods: [] });
  const [drafts, setDrafts] = useState({});
  const [closingDrafts, setClosingDrafts] = useState({});
  const [investmentOnlyDrafts, setInvestmentOnlyDrafts] = useState({});
  const [newNames, setNewNames] = useState({});
  const [loading, setLoading] = useState(false);

  const activeItems = useMemo(() => data[activeTab] || [], [activeTab, data]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: payload } = await api.get("/transactions/reference-data");
      setData(payload || { categories: [], banks: [], people: [], payment_methods: [] });
      const nextDrafts = {};
      const nextClosingDrafts = {};
      const nextInvestmentOnlyDrafts = {};
      for (const group of EDITABLE_GROUPS) {
        for (const item of payload?.[group.key] || []) {
          nextDrafts[`${group.key}:${item.id}`] = item.name;
          if (group.key === "banks") {
            nextClosingDrafts[`${group.key}:${item.id}`] = item.closing_day || "";
            nextInvestmentOnlyDrafts[`${group.key}:${item.id}`] = Boolean(item.investments_only);
          }
        }
      }
      setDrafts(nextDrafts);
      setClosingDrafts(nextClosingDrafts);
      setInvestmentOnlyDrafts(nextInvestmentOnlyDrafts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const setDraft = (kind, id, value) => {
    setDrafts((prev) => ({ ...prev, [`${kind}:${id}`]: value }));
  };
  const setClosingDraft = (kind, id, value) => {
    setClosingDrafts((prev) => ({ ...prev, [`${kind}:${id}`]: value }));
  };
  const setInvestmentOnlyDraft = (kind, id, value) => {
    setInvestmentOnlyDrafts((prev) => ({ ...prev, [`${kind}:${id}`]: value }));
  };

  const createItem = async (kind) => {
    const name = (newNames[kind] || "").trim();
    if (!name) {
      Swal.fire({ title: "Nome obrigatorio", icon: "warning" });
      return;
    }

    try {
      await api.post(`/transactions/reference-data/${kind}`, {
        name,
        closing_day: kind === "banks" ? null : undefined,
        investments_only: false,
      });
      setNewNames((prev) => ({ ...prev, [kind]: "" }));
      await load();
      onChanged?.();
      Swal.fire({
        title: "Cadastro criado!",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      const msg = err?.response?.data?.message || "Nao foi possivel criar.";
      Swal.fire({ title: "Erro", text: msg, icon: "error" });
    }
  };

  const saveItem = async (kind, item) => {
    const name = (drafts[`${kind}:${item.id}`] || "").trim();
    const closingDay = closingDrafts[`${kind}:${item.id}`] || "";
    const investmentsOnly = Boolean(investmentOnlyDrafts[`${kind}:${item.id}`]);
    if (!name) {
      Swal.fire({ title: "Nome obrigatorio", icon: "warning" });
      return;
    }

    try {
      await api.patch(`/transactions/reference-data/${kind}/${item.id}`, {
        name,
        ...(kind === "banks" ? { closing_day: closingDay, investments_only: investmentsOnly } : {}),
      });
      await load();
      onChanged?.();
      Swal.fire({
        title: "Cadastro atualizado!",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      const msg = err?.response?.data?.message || "Nao foi possivel salvar.";
      Swal.fire({ title: "Erro", text: msg, icon: "error" });
    }
  };

  const deleteItem = async (kind, item) => {
    const result = await Swal.fire({
      title: "Excluir cadastro?",
      text: item.usage_count
        ? "Este cadastro esta em uso e nao sera removido."
        : "Esta acao remove apenas o cadastro, nao transacoes.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Excluir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d32f2f",
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/transactions/reference-data/${kind}/${item.id}`);
      await load();
      onChanged?.();
      Swal.fire({
        title: "Cadastro excluido!",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      const msg = err?.response?.data?.message || "Nao foi possivel excluir.";
      Swal.fire({ title: "Erro", text: msg, icon: "error" });
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Edicao</Typography>
          <Typography variant="body2" color="text.secondary">
            Ajuste nomes de categorias, bancos, pessoas e metodos de pagamento.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={load}
          disabled={loading}
        >
          Atualizar
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {EDITABLE_GROUPS.map((group) => (
              <Tab key={group.key} value={group.key} label={group.label} />
            ))}
          </Tabs>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1.25}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "minmax(220px, 1fr) auto" },
                gap: 1,
                alignItems: "center",
              }}
            >
              <TextField
                size="small"
                label="Novo cadastro"
                value={newNames[activeTab] || ""}
                onChange={(event) => {
                  setNewNames((prev) => ({ ...prev, [activeTab]: event.target.value }));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    createItem(activeTab);
                  }
                }}
                fullWidth
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => createItem(activeTab)}
                disabled={!String(newNames[activeTab] || "").trim()}
              >
                Criar
              </Button>
            </Box>

            <Divider />

            {activeItems.map((item) => {
              const draftKey = `${activeTab}:${item.id}`;
              const nameChanged = (drafts[draftKey] || "") !== item.name;
              const closingChanged = activeTab === "banks"
                && String(closingDrafts[draftKey] ?? "") !== String(item.closing_day || "");
              const investmentOnlyChanged = activeTab === "banks"
                && Boolean(investmentOnlyDrafts[draftKey]) !== Boolean(item.investments_only);
              const changed = nameChanged || closingChanged || investmentOnlyChanged;

              return (
                <Box
                  key={item.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: activeTab === "banks" ? "minmax(220px, 1fr) 130px 190px auto auto" : "minmax(220px, 1fr) auto auto",
                    },
                    gap: 1,
                    alignItems: "center",
                  }}
                >
                  <TextField
                    size="small"
                    value={drafts[draftKey] ?? item.name}
                    onChange={(event) => setDraft(activeTab, item.id, event.target.value)}
                    fullWidth
                  />
                  {activeTab === "banks" && (
                    <>
                      <TextField
                        size="small"
                        label="Dia fechamento"
                        type="number"
                        value={closingDrafts[draftKey] ?? item.closing_day ?? ""}
                        onChange={(event) => setClosingDraft(activeTab, item.id, event.target.value)}
                        inputProps={{ min: 1, max: 31 }}
                        fullWidth
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(investmentOnlyDrafts[draftKey])}
                            onChange={(event) => setInvestmentOnlyDraft(activeTab, item.id, event.target.checked)}
                          />
                        }
                        label="Apenas investimentos"
                      />
                    </>
                  )}
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Usado em ${item.usage_count || 0} transacoes`}
                  />
                  <Stack direction="row" justifyContent="flex-end">
                    <Tooltip title="Salvar alteracao">
                      <span>
                        <IconButton
                          color="primary"
                          size="small"
                          disabled={!changed}
                          onClick={() => saveItem(activeTab, item)}
                        >
                          <SaveIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={item.usage_count ? "Cadastro em uso" : "Excluir cadastro"}>
                      <span>
                        <IconButton
                          color="error"
                          size="small"
                          disabled={Boolean(item.usage_count)}
                          onClick={() => deleteItem(activeTab, item)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Box>
              );
            })}

            {!activeItems.length && (
              <Typography variant="body2" color="text.secondary">
                Nenhum cadastro encontrado.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
