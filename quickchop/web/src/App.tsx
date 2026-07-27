import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { Layout } from "@/components/Layout";
import { LoginPage } from "@/pages/LoginPage";
import { LiveOrdersPage } from "@/pages/LiveOrdersPage";
import { MenuManagementPage } from "@/pages/MenuManagementPage";
import { SalesOverviewPage } from "@/pages/SalesOverviewPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { SupportPage } from "@/pages/SupportPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ReviewsPage } from "@/pages/ReviewsPage";
import { SettingsPage } from "@/pages/SettingsPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuth((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div className="min-h-screen bg-canvas">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<LiveOrdersPage />} />
          <Route path="/menu" element={<MenuManagementPage />} />
          <Route path="/sales" element={<SalesOverviewPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
