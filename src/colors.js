export function generateColors(n) {
  const colors = [];
  for (let i = 0; i < n; i++) {
    const h = (i * 137.508) % 360; // golden angle distribution
    const s = 65 + (i % 3) * 10;
    const l = 50 + (i % 2) * 8;
    colors.push(`hsl(${h.toFixed(1)},${s}%,${l}%)`);
  }
  return colors;
}
