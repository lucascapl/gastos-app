import { useEffect, useState } from "react";
import { api } from "../api";
import {
  Card, CardContent, Typography, Grid, Divider, Chip, Stack, LinearProgress, List, ListItem, ListItemText
} from "@mui/material";
import { brl } from "../utils";

export default function BalanceCard({refreshKey, owner }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/balance");
    setData(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (refreshKey !== undefined) load(); }, [refreshKey]);

  if (loading) return <LinearProgress sx={{ mt: 2 }} />;

  const { saldo_total, totais, faturas, me_devem } = data || {};

  const listEntries = (obj) =>
    Object.entries(obj || {}).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));

  return (
    <Grid container spacing={2} sx={{ mt: 1 }}>
      <Grid item xs={12} md={5}>
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">Saldo total</Typography>
              <Chip size="small" label={`User: ${owner}`} />
            </Stack>
            <Typography variant="h4" color={saldo_total < 0 ? "error.main" : "success.main"} sx={{ fontWeight: 700 }}>
              {brl(saldo_total)}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} useFlexGap>
              <Chip size="small" variant="outlined" label={`Faturas abertas: ${brl(totais?.faturas_em_aberto || 0)}`} />
              <Chip size="small" variant="outlined" label={`Me devem: ${brl(totais?.me_devem_em_aberto || 0)}`} />
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={8}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2">Faturas por pessoa</Typography>
            <Divider sx={{ my: 1 }} />
            <List dense disablePadding>
              {listEntries(faturas).map(([p, v]) => (
                <ListItem 
                    key={p} 
                    disableGutters
                    secondaryAction={
                    <Chip 
                        size="small" 
                        label={brl(v)} 
                        color={v < 0 ? "error" : "success"} 
                        variant="outlined" 
                    />
                    }
                    sx={{ pr: 15 }}
                >
                <ListItemText primary={p} sx={{ overflow: "hidden", textOverflow: "ellipsis" }}/>
                </ListItem>
              ))}
              {!Object.keys(faturas || {}).length && (
                <Typography variant="body2" color="text.secondary">Sem valores em aberto</Typography>
              )}
            </List>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2">Me devem (débito) por pessoa</Typography>
            <Divider sx={{ my: 1 }} />
            <List dense disablePadding>
              {listEntries(me_devem).map(([p, v]) => (
                <ListItem key={p} disableGutters secondaryAction={<Chip size="small" label={brl(v)} color={v < 0 ? "error" : "success"} variant="outlined" />}>
                  <ListItemText primary={p} />
                </ListItem>
              ))}
              {!Object.keys(me_devem || {}).length && (
                <Typography variant="body2" color="text.secondary">Sem valores em aberto</Typography>
              )}
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
