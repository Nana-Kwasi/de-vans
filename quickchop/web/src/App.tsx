import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { Layout } from "@/components/Layout";
import { LoginPage } from "@/pages/LoginPage";
import { ForgotPasswordPage, ResetPasswordPage } from "@/pages/PasswordResetPages";
import { LegalPage } from "@/pages/LegalPage";
import { PoliciesPage } from "@/pages/PoliciesPage";
import { ConsentsPage } from "@/pages/ConsentsPage";
import { LiveOrdersPage } from "@/pages/LiveOrdersPage";
import { OrderDetailPage } from "@/pages/OrderDetailPage";
import { MenuManagementPage } from "@/pages/MenuManagementPage";
import { SalesOverviewPage } from "@/pages/SalesOverviewPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { SupportPage } from "@/pages/SupportPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ReviewsPage } from "@/pages/ReviewsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { RidersPage } from "@/pages/RidersPage";
import { DeliveriesPage } from "@/pages/DeliveriesPage";
import { RiderLayout } from "@/rider/RiderLayout";
import { RiderLoginPage } from "@/rider/pages/RiderLoginPage";
import { RiderHomePage } from "@/rider/pages/RiderHomePage";
import { RiderRequestsPage } from "@/rider/pages/RiderRequestsPage";
import { RiderActiveRedirect, RiderDeliveryPage } from "@/rider/pages/RiderDeliveryPage";
import { RiderHistoryPage } from "@/rider/pages/RiderHistoryPage";
import { RiderAccountPage } from "@/rider/pages/RiderAccountPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuth((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div className="min-h-screen bg-canvas">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Public policy pages (no sign-in): link these from the app stores and website. */}
        <Route path="/legal" element={<Navigate to="/legal/customer-privacy" replace />} />
        <Route path="/legal/:slug" element={<LegalPage />} />
        <Route path="/privacy" element={<Navigate to="/legal/customer-privacy" replace />} />
        <Route path="/terms" element={<Navigate to="/legal/customer-terms" replace />} />

        {/* Rider portal: own sign-in, own session, phone-first layout. */}
        <Route path="/rider/login" element={<RiderLoginPage />} />
        <Route path="/rider" element={<RiderLayout />}>
          <Route index element={<RiderHomePage />} />
          <Route path="requests" element={<RiderRequestsPage />} />
          <Route path="active" element={<RiderActiveRedirect />} />
          <Route path="jobs/:id" element={<RiderDeliveryPage />} />
          <Route path="history" element={<RiderHistoryPage />} />
          <Route path="account" element={<RiderAccountPage />} />
        </Route>

        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<LiveOrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/deliveries" element={<DeliveriesPage />} />
          <Route path="/riders" element={<RidersPage />} />
          <Route path="/menu" element={<MenuManagementPage />} />
          <Route path="/sales" element={<SalesOverviewPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/consents" element={<ConsentsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
