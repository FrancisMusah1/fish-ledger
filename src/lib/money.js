// Money is stored as whole pesewas (integers) to avoid decimal errors.
// 1 cedi = 100 pesewas, so GH₵ 25.50 is stored as 2550.

// Typed cedis -> pesewas. Math.round removes floating-point noise.
export const toPesewas = (cedis) => Math.round(Number(cedis) * 100);

// Pesewas -> display text such as "GH₵ 195,840.00".
export const formatCedis = (pesewas) =>
  'GH₵ ' +
  (pesewas / 100).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });