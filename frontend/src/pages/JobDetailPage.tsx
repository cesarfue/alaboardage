import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export function JobDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data, isLoading, error } = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.getJob(id),
    enabled: Boolean(id),
  })

  if (isLoading) return <p>Loading…</p>
  if (error) return <p>Error: {(error as Error).message}</p>
  if (!data) return null

  return (
    <div>
      <h1>{data.title}</h1>
      <p>Placeholder detail page — start building from here.</p>
    </div>
  )
}
