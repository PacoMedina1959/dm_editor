import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ValidarYamlPage from './pages/ValidarYamlPage.jsx'
import CatalogoPage from './pages/CatalogoPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/validar" replace />} />
          <Route path="/validar" element={<ValidarYamlPage />} />
          <Route path="/catalogo" element={<CatalogoPage />} />
          <Route path="*" element={<Navigate to="/validar" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
