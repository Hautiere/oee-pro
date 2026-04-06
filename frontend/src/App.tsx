import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from './pages/LoginPage'
import AssetsPage from './pages/AssetsPage'
import DashboardPage from './pages/DashboardPage'
import ImportPage from './pages/ImportPage'
import PrivateRoute from './components/PrivateRoute'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          } />
          <Route path="/assets" element={
            <PrivateRoute>
              <AssetsPage />
            </PrivateRoute>
          } />
          <Route path="/import" element={
            <PrivateRoute>
              <ImportPage />
            </PrivateRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
