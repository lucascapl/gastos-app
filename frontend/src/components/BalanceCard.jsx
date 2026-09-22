import { useMemo } from "react";
import {
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { brl } from "../utils";

const norm = (value) => String(value || "").trim().toLowerCase();

function buildAvailableBalance(items, owner, profile) {
  const initialBalance = Number(profile?.initial_balance || 0);
  let accountMovement = initialBalance;
  let ownCreditInvoices = 0;

  for (const item of items || []) {
    if (item.is_projected) continue;

    const value = Number(item.value || 0);
    const isOwner = norm(item.person) === norm(owner);
    const payment = norm(item.payment);

    if (item.tx_type === "reembolso_credito") {
      continue;
    }

    if (item.tx_type === "reembolso_debito") {
      accountMovement += value;
      continue;
    }

    if (isOwner) {
      if (payment === "credito") {
        ownCreditInvoices += value;
      } else {
        accountMovement += value;
      }
    } else if (payment === "debito") {
      accountMovement += value;
    } else if (payment !== "credito") {
      accountMovement += value;
    }
  }

  return {
    accountMovement: Math.round(accountMovement * 100) / 100,
    ownCreditInvoices: Math.round(ownCreditInvoices * 100) / 100,
    available: Math.round((accountMovement + ownCreditInvoices) * 100) / 100,
  };
}

export default function BalanceCard({ owner, items, profile }) {
  const data = useMemo(
    () => buildAvailableBalance(items, owner, profile),
    [items, owner, profile]
  );

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2">Saldo disponivel</Typography>
          <Chip size="small" label={`User: ${owner}`} />
        </Stack>
        <Typography
          variant="h4"
          color={data.available < 0 ? "error.main" : "success.main"}
          sx={{ fontWeight: 700 }}
        >
          {brl(data.available)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Saldo em conta menos sua parte nas faturas de credito.
        </Typography>
      </CardContent>
    </Card>
  );
}
