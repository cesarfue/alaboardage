import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { JobsListPage } from './pages/JobsListPage'
import { JobDetailPage } from './pages/JobDetailPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <JobsListPage /> },
      { path: 'jobs/:id', element: <JobDetailPage /> },
    ],
  },
])
