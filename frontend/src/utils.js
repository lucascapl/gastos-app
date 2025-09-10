export const brl = (n) =>
  (typeof n === "number" ? n : Number(n ?? 0))
    .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const parseISODate = (s) => (s ? new Date(s) : null);

export const unique = (arr) => [...new Set(arr.filter(Boolean))];
