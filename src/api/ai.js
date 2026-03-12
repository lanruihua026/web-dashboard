import axios from 'axios'

const http = axios.create({
  baseURL: '/ai-api',
  timeout: 10000
})

export async function fetchLatestAiResult() {
  const { data } = await http.get('/latest-result')
  return data
}
