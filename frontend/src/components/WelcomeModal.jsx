import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormControlLabel,
  Checkbox,
  Box
} from "@mui/material";
import Cookies from "js-cookie";

const COOKIE_NAME = "gastos_welcome_seen";
const COOKIE_DAYS = 30;

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const seen = Cookies.get(COOKIE_NAME);
    if (!seen) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    if (dontShowAgain) {
      Cookies.set(COOKIE_NAME, "true", { expires: COOKIE_DAYS });
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>👋 Bem-vindo ao Balance.io</DialogTitle>

      <DialogContent dividers>
        <Box mb={2}>
          <Typography gutterBottom>
            Este aplicativo foi criado para facilitar o controle das suas finanças pessoais.
          </Typography>
        </Box>

        <Typography variant="h6">Como funciona?</Typography>
        <Typography>
          Valores positivos = receitas<br />
          Valores negativos = gastos
        </Typography>

        <Box mt={2}>
            <Typography variant="h6">Fechamento da fatura</Typography>
            <Typography>
            Comece definindo a data de fechamento da sua fatura<br />
            Ao selecionar a data, clique no cadeado para salvar.
            </Typography>
        </Box>

        <Box mt={2}>
          <Typography variant="h6">Pessoas</Typography>
          <Typography>
            Ao cadastrar um gasto/receita coloque manualmente o nome da pessoa. <br/>
            O sistema salvará automaticamente para as próximas vezes.<br/>
            <b>Importante!</b> <br/>
            Compras feitas pela pessoa de mesmo nome do usuario, diminuirão seu saldo independente de ser credito ou debito
          </Typography>
        </Box>

        <Box mt={2}>
          <Typography variant="h6">Forma de Pagamento</Typography>
          <Typography>
            Credito → entra em fatura<br />
            Debito → sai imediatamente
          </Typography>
        </Box>

        <Box mt={2}>
          <Typography variant="h6">Categorias</Typography>
          <Typography>
            Crie qualquer categoria de gastos. O sistema salva automaticamente.
          </Typography>
        </Box>

        <Box mt={2}>
          <Typography variant="h6">Evento</Typography>
          <Typography>
            O campo Evento é o nome da compra.
            Pode ser qualquer descrição curta.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <FormControlLabel
          control={
            <Checkbox
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
          }
          label="Não mostrar novamente por 30 dias"
        />

        <Button variant="contained" onClick={handleClose}>
          Entendi
        </Button>
      </DialogActions>
    </Dialog>
  );
}
