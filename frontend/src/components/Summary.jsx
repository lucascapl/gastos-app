import { brl } from "../utils";
import { Grid, Card, CardContent, Typography, Divider, Box } from "@mui/material";

export default function Summary({ items = [] }) {
  const total = items.reduce((acc, t) => acc + Number(t.value || 0), 0);

  const by = (key) => {
    const map = new Map();
    for (const t of items) {
      const k = t[key] || "—";
      map.set(k, (map.get(k) || 0) + Number(t.value || 0));
    }
    return [...map.entries()].sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  };
  const topCat = by("category").slice(0,5);
  const topPeople = by("person").slice(0,5);

  return (
    <Grid container spacing={2} sx={{ mt: 1 }}>
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2">Total</Typography>
            <Typography variant="h4" color={total < 0 ? "error.main" : "success.main"} sx={{ fontWeight: 700 }}>
              {brl(total)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Negativo = gasto, positivo = receita
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2">Por categoria (top 5)</Typography>
            <Divider sx={{ my: 1 }} />
            {topCat.map(([k,v])=>(
              <Row key={k} left={k} right={brl(v)} />
            ))}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2">Por pessoa (top 5)</Typography>
            <Divider sx={{ my: 1 }} />
            {topPeople.map(([k,v])=>(
              <Row key={k} left={k} right={brl(v)} />
            ))}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function Row({ left, right }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        py: 0.75,
        gap: 2,
        // responsivo: coluna em telas muito pequenas, linha em sm+
        flexDirection: { xs: "column", sm: "row" },
      }}
    >
      <Typography
        component="span"
        sx={{
          flex: "1 1 auto",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {left}
      </Typography>

      <Typography
        component="span"
        sx={{
          flex: "0 0 auto",
          whiteSpace: "nowrap",
          // quando empilhado, alinha o valor à direita
          alignSelf: { xs: "flex-end", sm: "auto" },
          ml: { xs: 0, sm: 3 },
        }}
      >
        {right}
      </Typography>
    </Box>
  );
}
