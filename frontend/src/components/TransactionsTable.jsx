import { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { IconButton, Tooltip } from "@mui/material";
import Swal from "sweetalert2";
import { api } from "../api";

const brl = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(Number(v || 0));

const pad = (value) => String(value).padStart(2, "0");

const addOneMonth = (isoDate) => {
  const [year, month, day] = String(isoDate || "").split("-").map(Number);
  if (!year || !month || !day) return isoDate;

  const target = new Date(year, month, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(Math.min(day, lastDay))}`;
};

export default function TransactionsTable({ items, optionsVersion = 0, onSaved }) {
  const [rows, setRows] = useState([]);
  const [options, setOptions] = useState({
    categories: [],
    payment_methods: [],
    people: [],
  });

  // mantém as linhas sincronizadas com o filtro vindo do App.jsx
  useEffect(() => { setRows(items); }, [items]);

  // carrega opções para os selects (recarrega quando optionsVersion mudar)
  useEffect(() => {
    (async () => {
      const { data } = await api.get("/transactions/options");
      setOptions(data || { categories: [], payment_methods: [], people: [] });
    })();
  }, [optionsVersion]);

  // colunas com edição inline; metodo de pagamento e person como selects
  const duplicateNextMonth = useCallback(async (row) => {
    const payload = {
      value: row.value,
      event: row.event,
      day: addOneMonth(row.day),
      category: row.category || "",
      payment: row.payment || "",
      person: row.person || "",
      tx_type: row.tx_type || "normal",
    };

    try {
      await api.post("/transactions", payload);
      Swal.fire({
        title: "Compra recriada!",
        text: `Nova data: ${payload.day}`,
        icon: "success",
        timer: 1600,
        showConfirmButton: false,
      });
      onSaved && onSaved();
    } catch (err) {
      const msg = err?.response?.data?.message || "Nao foi possivel recriar a compra.";
      Swal.fire({ title: "Erro", text: msg, icon: "error" });
    }
  }, [onSaved]);

  const columns = useMemo(() => ([
    {
      field: "_actions",
      headerName: "",
      width: 64,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Tooltip title="Recriar para o proximo mes">
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              duplicateNextMonth(params.row);
            }}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
    { field: "id", headerName: "ID", width: 80 },
    { field: "day", headerName: "Data", width: 115, editable: true },
    { field: "event", headerName: "Evento", flex: 1, minWidth: 180, editable: true },
    {
      field: "value",
      headerName: "Valor",
      width: 130,
      editable: true,

      // texto mostrado na célula (fora do modo edição)
      valueFormatter: (params) => brl(params.value),

      // cor verde p/ positivo e vermelha p/ negativo
      renderCell: (params) => {
        const v = Number(params.value || 0);
        const isNeg = v < 0;
        return (
          <span
            style={{
              color: isNeg ? "#d32f2f" : "#2e7d32",
              fontWeight: 600,
            }}
          >
            {brl(v)}
          </span>
        );
      },
    },
    {
      field: "category",
      headerName: "Categoria",
      width: 160,
      editable: true,
      type: "singleSelect",
      valueOptions: options.categories,
    },
    {
      field: "payment",
      headerName: "Tipo de pagamento",
      width: 180,
      editable: true,
      type: "singleSelect",
      valueOptions: options.payment_methods,
    },
    {
      field: "person",
      headerName: "Pessoa",
      width: 160,
      editable: true,
      type: "singleSelect",
      valueOptions: options.people,
    },
  ]), [duplicateNextMonth, options]);

  // envia apenas dos campos alterados
  const diffPayload = (newRow, oldRow) => {
    const fields = ["day", "event", "value", "category", "payment", "person"];
    const payload = {};
    for (const f of fields) {
      if (newRow[f] !== oldRow[f]) payload[f] = newRow[f];
    }
    return payload;
  };

  // Chamado quando a edição termina (por Enter ou ao clicar fora/blur)
  const processRowUpdate = async (newRow, oldRow) => {
    const payload = diffPayload(newRow, oldRow);
    if (Object.keys(payload).length === 0) return oldRow;

    try {
      const { data } = await api.patch(`/transactions/${newRow.id}`, payload);
      // Atualiza a linha no estado local
      setRows((prev) => prev.map((r) => (r.id === newRow.id ? { ...r, ...data, day: data.day?.slice(0, 10) } : r)));

      // modal de confirmacao
      Swal.fire({
        title: "Alteração salva!",
        text: "A transação foi atualizada com sucesso.",
        icon: "success",
        timer: 1600,
        showConfirmButton: false,
      });

      // atualiza saldo e resumos
      onSaved && onSaved();

      return { ...newRow, ...data, day: data.day?.slice(0, 10) };
    } catch (err) {
      // Falha — erro e abortamos a atualização visual
      let msg = "Não foi possível salvar a alteração.";
      if (err?.response?.data?.message) msg = err.response.data.message;
      Swal.fire({ title: "Erro", text: msg, icon: "error" });
      throw err;
    }
  };

  const handleProcessRowUpdateError = () => {
    console.log("erro ao atualizar tabela de transacao");
  };

  return (
    <div style={{ height: 560, width: "100%", marginTop: 16 }}>
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        editMode="row"
        processRowUpdate={processRowUpdate}
        onProcessRowUpdateError={handleProcessRowUpdateError}
        disableRowSelectionOnClick
        pageSizeOptions={[8, 15, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 8 } } }}
      />
    </div>
  );
}
