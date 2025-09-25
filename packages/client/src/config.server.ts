import 'server-only'

export const API_URI = process.env.API_URI
  ? process.env.API_URI
  : 'http://localhost:8000'
