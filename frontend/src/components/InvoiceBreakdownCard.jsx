import { Card, CardContent, Chip, Divider, Grid, List, ListItem, ListItemText, Stack, Typography } from "@mui/material";
import { brl } from "../utils";

const norm = (value) => String(value || "").trim().toLowerCase();

function EntryGrid({ rows, emptyText }) {
  if (!rows.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }

  return (
    <List
      dense
      disablePadding
      sx={{
        display: "grid",
        columnGap: { xs: 0, md: 2 },
        rowGap: 0,
        gridAutoFlow: { xs: "row", md: "column" },
        gridTemplateRows: { xs: "none", md: "repeat(3, auto)" },
        gridAutoColumns: { xs: "auto", md: "minmax(240px, 1fr)" },
        overflowX: "auto",
      }}
    >
      {rows.map(([label, value]) => (
        <ListItem
          key={label}
          disableGutters
          secondaryAction={
            <Chip
              size="small"
              label={brl(value)}
              color={value < 0 ? "error" : "success"}
              variant="outlined"
            />
          }
          sx={{ pr: 15, py: 0.15, minHeight: 30 }}
        >
          <ListItemText
            primary={label}
            primaryTypographyProps={{ variant: "body2", noWrap: true }}
            sx={{ my: 0 }}
          />
        </ListItem>
      ))}
    </List>
  );
}

export default function InvoiceBreakdownCard({ items = [], owner, filters }) {
  const hasInvoiceFilter = Boolean(filters?.from && filters?.to && filters?.bank && filters?.payment === "Credito");
  const creditItems = items.filter((item) => norm(item.payment) === "credito");
  const byPerson = new Map();
  const byCategory = new Map();

  for (const item of creditItems) {
    const person = item.person || "-";
    const category = item.category || "Sem categoria | Outras pessoas";
    byPerson.set(person, (byPerson.get(person) || 0) + Number(item.value || 0));
    byCategory.set(category, (byCategory.get(category) || 0) + Number(item.value || 0));
  }

  const rows = [...byPerson.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const categoryRows = [...byCategory.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const total = creditItems.reduce((acc, item) => acc + Number(item.value || 0), 0);
  const ownerTotal = rows.find(([person]) => norm(person) === norm(owner))?.[1] || 0;
  const othersTotal = total - ownerTotal;

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          gap={1}
          sx={{ mb: 1 }}
        >
          <div>
            <Typography variant="subtitle2">Fatura selecionada</Typography>
            <Typography variant="body2" color="text.secondary">
              {hasInvoiceFilter
                ? `${filters.bank} - ${filters.from} ate ${filters.to}`
                : "Selecione banco e mes da fatura acima."}
            </Typography>
          </div>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip variant="outlined" label={`Total: ${brl(total)}`} />
            <Chip variant="outlined" label={`Minha parte: ${brl(ownerTotal)}`} color={ownerTotal < 0 ? "error" : "success"} />
            <Chip
              variant="outlined"
              label={`Outras pessoas: ${brl(othersTotal)}`}
              sx={{
                color: "warning.main",
                borderColor: "warning.main",
              }}
            />
          </Stack>
        </Stack>

        <Divider sx={{ my: 1 }} />

        <Grid container columnSpacing={{ xs: 2, md: 6 }} rowSpacing={1}>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">Por pessoa</Typography>
            <EntryGrid
              rows={rows}
              emptyText="Nenhuma transacao de credito para a fatura selecionada."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">Por categoria</Typography>
            <EntryGrid
              rows={categoryRows}
              emptyText="Nenhuma categoria para a fatura selecionada."
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
