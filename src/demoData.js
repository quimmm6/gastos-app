export const DEMO_RECURRENTS = [
  { rowIndex: 2, dia: '1', inici: '2026-01-01', importe: 1500, tipo: 'ingreso', categoria: 'Nòmina', descripcion: 'Nòmina mensual', activa: true },
  { rowIndex: 3, dia: '1', inici: '2026-01-01', importe: 700, tipo: 'gasto', categoria: 'Lloguer', descripcion: 'Lloguer pis', activa: true },
  { rowIndex: 4, dia: '7', inici: '2026-01-01', importe: 9.99, tipo: 'gasto', categoria: 'Subscripcions', descripcion: 'Spotify', activa: true },
  { rowIndex: 5, dia: '15', inici: '2026-01-01', importe: 18.90, tipo: 'gasto', categoria: 'Transport', descripcion: 'TMB mensual', activa: false },
]

export const DEMO_CATEGORIES = {
  gasto: [
    { name: 'Bar', icon: '🍻' },
    { name: 'Àpats', icon: '🍴' },
    { name: 'Restaurants', icon: '🍽️' },
    { name: 'Supermercat', icon: '🛒' },
    { name: 'Transport', icon: '🚅' },
    { name: 'Subscripcions', icon: '☁️' },
    { name: 'Oci', icon: '🥳' },
    { name: 'Roba', icon: '🛍️' },
    { name: 'Lloguer', icon: '🏠' },
    { name: 'Altres', icon: '📌' },
  ],
  ingreso: [
    { name: 'Nòmina', icon: '💶' },
    { name: 'Dietes', icon: '💰' },
    { name: 'Regal Personal', icon: '🎁' },
  ],
}

function tx(fecha, importe, tipo, categoria, descripcion, id, actiu = true) {
  return { fecha, importe, tipo, categoria, descripcion, id, actiu }
}

export const DEMO_TRANSACTIONS = [
  // Juny 2026
  tx('2026-06-01', 1500.00, 'ingreso', 'Nòmina', 'Nòmina juny', 'rec-demo-01'),
  tx('2026-06-01', 700.00, 'gasto', 'Lloguer', 'Lloguer juny', 'rec-demo-02'),
  tx('2026-06-03', 87.40, 'gasto', 'Supermercat', 'Mercadona', 'demo-03'),
  tx('2026-06-05', 12.50, 'gasto', 'Bar', 'Vermuts dissabte', 'demo-04'),
  tx('2026-06-07', 9.99, 'gasto', 'Subscripcions', 'Spotify', 'rec-demo-05'),
  tx('2026-06-10', 34.80, 'gasto', 'Restaurants', 'Sopar aniversari', 'demo-06'),
  tx('2026-06-12', 62.15, 'gasto', 'Roba', 'Zara', 'demo-07'),
  tx('2026-06-14', 150.00, 'ingreso', 'Dietes', 'Dietes viatge feina', 'demo-08'),
  tx('2026-06-15', 18.90, 'gasto', 'Transport', 'TMB mensual', 'rec-demo-09'),
  tx('2026-06-18', 45.00, 'gasto', 'Àpats', 'Dinar amb clients', 'demo-10'),
  tx('2026-06-20', 23.60, 'gasto', 'Supermercat', 'Condis', 'demo-11'),
  tx('2026-06-20', 700.00, 'gasto', 'Lloguer', 'Lloguer juny (inactiu)', 'rec-demo-02b', false),

  // Maig 2026
  tx('2026-05-01', 1500.00, 'ingreso', 'Nòmina', 'Nòmina maig', 'rec-demo-m01'),
  tx('2026-05-01', 700.00, 'gasto', 'Lloguer', 'Lloguer maig', 'rec-demo-m02'),
  tx('2026-05-04', 91.20, 'gasto', 'Supermercat', 'Mercadona', 'demo-m03'),
  tx('2026-05-06', 22.00, 'gasto', 'Bar', 'Copes divendres', 'demo-m04'),
  tx('2026-05-07', 9.99, 'gasto', 'Subscripcions', 'Spotify', 'rec-demo-m05'),
  tx('2026-05-10', 55.00, 'gasto', 'Oci', 'Concert', 'demo-m06'),
  tx('2026-05-15', 18.90, 'gasto', 'Transport', 'TMB mensual', 'rec-demo-m09'),
  tx('2026-05-19', 38.40, 'gasto', 'Restaurants', 'Sopar cap de setmana', 'demo-m10'),
  tx('2026-05-28', 110.00, 'gasto', 'Roba', 'Compres primavera', 'demo-m11'),

  // Abril 2026
  tx('2026-04-01', 1500.00, 'ingreso', 'Nòmina', 'Nòmina abril', 'rec-demo-a01'),
  tx('2026-04-01', 700.00, 'gasto', 'Lloguer', 'Lloguer abril', 'rec-demo-a02'),
  tx('2026-04-03', 78.60, 'gasto', 'Supermercat', 'Mercadona', 'demo-a03'),
  tx('2026-04-07', 9.99, 'gasto', 'Subscripcions', 'Spotify', 'rec-demo-a05'),
  tx('2026-04-12', 200.00, 'ingreso', 'Regal Personal', 'Regal aniversari', 'demo-a06'),
  tx('2026-04-15', 18.90, 'gasto', 'Transport', 'TMB mensual', 'rec-demo-a09'),
  tx('2026-04-20', 48.75, 'gasto', 'Restaurants', 'Sopar amics', 'demo-a10'),
  tx('2026-04-25', 15.80, 'gasto', 'Bar', 'Aperitius', 'demo-a11'),
]
