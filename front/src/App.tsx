import { Route, Routes } from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout";
import AdminLayout from "./layouts/AdminLayout";
import ClientLayout from "./layouts/ClientLayout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import RequireAuth from "./components/RequireAuth";
import Dashboard from "./pages/admin/Dashboard";
import BornesList from "./pages/admin/BornesList";
import BorneDetail from "./pages/admin/BorneDetail";
import Sessions from "./pages/admin/Sessions";
import Utilisateurs from "./pages/admin/Utilisateurs";
import Vehicules from "./pages/admin/Vehicules";
import Maintenance from "./pages/admin/Maintenance";
import Alertes from "./pages/admin/Alertes";
import Rapports from "./pages/admin/Rapports";
import Documents from "./pages/admin/Documents";
import Audit from "./pages/admin/Audit";
import Firmware from "./pages/admin/Firmware";
import Paiement from "./pages/admin/Paiement";
import Parametres from "./pages/admin/Parametres";
import Simulator from "./pages/admin/Simulator";
import ClientBornes from "./pages/client/Bornes";
import ClientVehicules from "./pages/client/Vehicules";
import ClientHistorique from "./pages/client/Historique";
import ClientBadge from "./pages/client/Badge";
import ClientFactures from "./pages/client/Factures";
import ClientSuivi from "./pages/client/Suivi";
import ClientSimulateur from "./pages/client/Simulateur";

// Every role except "Client" belongs on the operator/admin back-office side.
const STAFF_ROLES = [
  "super_admin",
  "exploitant",
  "operateur",
  "technicien",
  "service_client",
  "finance",
];

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/dashboard"
        element={
          <RequireAuth roles={STAFF_ROLES} fallback="/client">
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="bornes" element={<BornesList />} />
        <Route path="bornes/:id" element={<BorneDetail />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="utilisateurs" element={<Utilisateurs />} />
        <Route path="vehicules" element={<Vehicules />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="alertes" element={<Alertes />} />
        <Route path="rapports" element={<Rapports />} />
        <Route path="documents" element={<Documents />} />
        <Route path="paiement" element={<Paiement />} />
        <Route path="firmware" element={<Firmware />} />
        <Route path="audit" element={<Audit />} />
        <Route path="parametres" element={<Parametres />} />
        <Route path="simulator" element={<Simulator />} />
      </Route>

      <Route
        path="/client"
        element={
          <RequireAuth roles={["client"]} fallback="/dashboard">
            <ClientLayout />
          </RequireAuth>
        }
      >
        <Route index element={<ClientBornes />} />
        <Route path="vehicules" element={<ClientVehicules />} />
        <Route path="historique" element={<ClientHistorique />} />
        <Route path="badge" element={<ClientBadge />} />
        <Route path="suivi" element={<ClientSuivi />} />
        <Route path="simulateur" element={<ClientSimulateur />} />
        <Route path="factures" element={<ClientFactures />} />
      </Route>
    </Routes>
  );
}

export default App;
