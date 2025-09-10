import { brl } from "../utils";
import {
  Paper, Table, TableContainer, TableHead, TableBody,
  TableRow, TableCell, Chip
} from "@mui/material";

export default function TransactionsTable({ items = [] }) {
  return (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Dia</TableCell>
            <TableCell>Evento</TableCell>
            <TableCell align="right">Valor</TableCell>
            <TableCell>Categoria</TableCell>
            <TableCell>Pagamento</TableCell>
            <TableCell>Pessoa</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map(t=>(
            <TableRow key={t.id} hover>
              <TableCell>{t.day}</TableCell>
              <TableCell>{t.event}</TableCell>
              <TableCell align="right">
                <Chip
                  label={brl(t.value)}
                  color={Number(t.value) < 0 ? "error" : "success"}
                  variant="outlined"
                  size="small"
                />
              </TableCell>
              <TableCell>{t.category || "—"}</TableCell>
              <TableCell>{t.payment || "—"}</TableCell>
              <TableCell>{t.person || "—"}</TableCell>
            </TableRow>
          ))}
          {!items.length && (
            <TableRow>
              <TableCell colSpan={6} align="center">Sem registros</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
