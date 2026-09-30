export const toPesewas = (cedis) => Math.round(Number(cedis) * 100);

export const formatCedis = (pesewas) =>
  'GH₵ ' +
  (pesewas / 100).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });