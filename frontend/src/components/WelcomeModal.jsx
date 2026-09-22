import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api } from "../api";

const emptyBank = {
  id: null,
  name: "",
  closing_day: "",
  investments_only: false,
};

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [initialBalance, setInitialBalance] = useState("");
  const [banks, setBanks] = useState([{ ...emptyBank }]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/profile");
        const hasBanks = Boolean(data.banks?.length);
        const hasInitialBalance = Number(data.initial_balance || 0) !== 0;

        setInitialBalance(data.initial_balance ?? "");
        setBanks(data.banks?.length ? data.banks.map((bank) => ({
          id: bank.id,
          name: bank.name || "",
          closing_day: bank.closing_day || "",
          investments_only: Boolean(bank.investments_only),
        })) : [{ ...emptyBank }]);
        setOpen(!hasBanks && !hasInitialBalance);
      } catch {
        setBanks([{ ...emptyBank }]);
      }
    })();
  }, []);

  const patchBank = (index, key, value) => {
    setBanks((current) => current.map((bank, bankIndex) => (
      bankIndex === index ? { ...bank, [key]: value } : bank
    )));
  };

  const saveSetup = async () => {
    await api.patch("/profile", {
      initial_balance: Number(initialBalance || 0),
    });

    for (const bank of banks) {
      const name = bank.name.trim();
      if (!name) continue;
      const payload = {
        name,
        closing_day: bank.closing_day || "",
        investments_only: Boolean(bank.investments_only),
      };
      if (bank.id) {
        await api.patch(`/transactions/reference-data/banks/${bank.id}`, payload);
      } else {
        await api.post("/transactions/reference-data/banks", payload);
      }
    }
  };

  const handleClose = async ({ save = false } = {}) => {
    if (save) await saveSetup();
    setOpen(false);
  };

  return (
    <Dialog open={open} maxWidth="md" fullWidth>
      <DialogTitle>Bem-vindo ao Balance.io</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography gutterBottom>
              O app separa o controle do presente, suas projecoes, investimentos e faturas por pessoa.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Valores positivos sao receitas ou resgates. Valores negativos sao gastos, compras ou aplicacoes.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6">Fluxo de caixa</Typography>
            <Typography variant="body2">
              Use para fechar faturas reais por banco. Bancos marcados como apenas investimentos nao aparecem no filtro de fatura.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6">Projecao anual</Typography>
            <Typography variant="body2">
              Transacoes projetadas ficam fora das faturas reais, mas entram nos graficos e saldos acumulados.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6">Configuracao inicial</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Voce tambem pode alterar isso depois em Perfil e Edicao &gt; Bancos.
            </Typography>

            <Stack spacing={1.25}>
              <TextField
                size="small"
                label="Saldo inicial"
                type="number"
                value={initialBalance}
                onChange={(event) => setInitialBalance(event.target.value)}
                fullWidth
              />

              {banks.map((bank, index) => (
                <Box
                  key={bank.id || index}
                  sx={{
                    display: "grid",
                    gap: 1,
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "minmax(180px, 1fr) 140px 190px auto",
                    },
                    alignItems: "center",
                  }}
                >
                  <TextField
                    size="small"
                    label="Banco"
                    value={bank.name}
                    onChange={(event) => patchBank(index, "name", event.target.value)}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Dia fechamento"
                    type="number"
                    value={bank.closing_day}
                    onChange={(event) => patchBank(index, "closing_day", event.target.value)}
                    inputProps={{ min: 1, max: 31 }}
                    fullWidth
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(bank.investments_only)}
                        onChange={(event) => patchBank(index, "investments_only", event.target.checked)}
                      />
                    }
                    label="Apenas investimentos"
                  />
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => setBanks((current) => current.filter((_, bankIndex) => bankIndex !== index))}
                    disabled={banks.length === 1}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}

              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setBanks((current) => [...current, { ...emptyBank }])}
              >
                Adicionar banco
              </Button>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={() => handleClose()}>Pular</Button>
        <Button variant="contained" onClick={() => handleClose({ save: true })}>
          Salvar e continuar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
