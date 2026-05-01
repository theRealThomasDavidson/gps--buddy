export const Units = {
  distance: {
    close: {
      Imperial: { name: 'yards', value: 1.09361 },
      Metric: { name: 'meters', value: 1.0 },
    },
    far: {
      Imperial: { name: 'miles', value: 1609.344 },
      Metric: { name: 'kilometers', value: 1000.0 },
    },
  },
} as const

