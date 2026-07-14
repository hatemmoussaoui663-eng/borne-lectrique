import { Route, Routes } from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout";
import AdminLayout from "./layouts/AdminLayout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/admin/Dashboard";
import BornesList from "./pages/admin/BornesList";
import BorneDetail from "./pages/admin/BorneDetail";
import Sessions from "./pages/admin/Sessions";
import Utilisateurs from "./pages/admin/Utilisateurs";
import Vehicules from "./pages/admin/Vehicules";
import Maintenance from "./pages/admin/Maintenance";
import Alertes from "./pages/admin/Alertes";
import Rapports from "./pages/admin/Rapports";
import Parametres from "./pages/admin/Parametres";
import Test from "./pages/admin/Test";

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
      </Route>

      <Route path="/login" element={<Login />} />

      <Route path="/dashboard" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="bornes" element={<BornesList />} />
        <Route path="bornes/:id" element={<BorneDetail />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="utilisateurs" element={<Utilisateurs />} />
        <Route path="vehicules" element={<Vehicules />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="alertes" element={<Alertes />} />
        <Route path="rapports" element={<Rapports />} />
        <Route path="parametres" element={<Parametres />} />
        <Route path="test" element={<Test />} />
      </Route>
    </Routes>
  );
}

export default App;
