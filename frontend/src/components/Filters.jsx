import { unique } from "../utils";
import { Grid, TextField, MenuItem, Card, CardContent } from "@mui/material";

export default function Filters({ data = [], value, onChange }) {
  const categories = unique(data.map(d => d.category));
  const people = unique(data.map(d => d.person));
  const payments = unique(data.map(d => d.payment));
  const patch = (k, v) => onChange({ ...value, [k]: v });

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Grid container spacing={1}>
          <Grid item xs={12} sm={2.4}>
            <TextField size="small" type="date" label="De" value={value.from || ""}
              onChange={e=>patch("from", e.target.value)} fullWidth InputLabelProps={{shrink:true}} />
          </Grid>
          <Grid item xs={12} sm={2.4}>
            <TextField size="small" type="date" label="Até" value={value.to || ""}
              onChange={e=>patch("to", e.target.value)} fullWidth InputLabelProps={{shrink:true}} />
          </Grid>
          <Grid item xs={12} sm={2.4}>
            <TextField size="small" select label="Categoria" value={value.category || ""}
              onChange={e=>patch("category", e.target.value)} fullWidth>
              <MenuItem value="">Todas</MenuItem>
              {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={2.4}>
            <TextField size="small" select label="Pessoa" value={value.person || ""}
              onChange={e=>patch("person", e.target.value)} fullWidth>
              <MenuItem value="">Todas</MenuItem>
              {people.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={2.4}>
            <TextField size="small" select label="Pagamento" value={value.payment || ""}
              onChange={e=>patch("payment", e.target.value)} fullWidth>
              <MenuItem value="">Todos</MenuItem>
              {payments.map(pm => <MenuItem key={pm} value={pm}>{pm}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField size="small" label="Buscar por evento"
              value={value.q || ""} onChange={e=>patch("q", e.target.value)} fullWidth />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
