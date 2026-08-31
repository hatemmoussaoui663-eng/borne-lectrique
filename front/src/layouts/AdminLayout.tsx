import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Layout, Menu, Badge, Avatar, Dropdown, Input } from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
  TeamOutlined,
  CarOutlined,
  ToolOutlined,
  BellOutlined,
  BarChartOutlined,
  FolderOpenOutlined,
  SafetyOutlined,
  CloudDownloadOutlined,
  CreditCardOutlined,
  SettingOutlined,
  SearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
  AndroidOutlined,
} from "@ant-design/icons";
import { alertes } from "../mock/data";
import "../styles/admin-shared.css";
import "./AdminLayout.css";

const { Sider, Header, Content } = Layout;

// Every entry except "Tableau de bord" and "Paramètres" maps to a module in
// the intra-staff permission matrix (back/config/permissions.php) — a role
// with 'none' on that module never sees the menu entry at all.
const allItems: (NonNullable<MenuProps["items"]>[number] & { module?: string })[] = [
  {
    key: "/dashboard",
    icon: <DashboardOutlined />,
    label: "Tableau de bord",
    module: "dashboard",
  },
  { key: "/dashboard/bornes", icon: <ThunderboltOutlined />, label: "Bornes", module: "bornes" },
  { key: "/dashboard/sessions", icon: <HistoryOutlined />, label: "Sessions", module: "sessions" },
  {
    key: "/dashboard/utilisateurs",
    icon: <TeamOutlined />,
    label: "Utilisateurs",
    module: "utilisateurs",
  },
  { key: "/dashboard/vehicules", icon: <CarOutlined />, label: "Véhicules", module: "vehicules" },
  {
    key: "/dashboard/maintenance",
    icon: <ToolOutlined />,
    label: "Maintenance",
    module: "maintenance",
  },
  { key: "/dashboard/alertes", icon: <BellOutlined />, label: "Alertes", module: "alertes" },
  { key: "/dashboard/rapports", icon: <BarChartOutlined />, label: "Rapports", module: "rapports" },
  {
    key: "/dashboard/documents",
    icon: <FolderOpenOutlined />,
    label: "Documents",
    module: "documents",
  },
  {
    key: "/dashboard/paiement",
    icon: <CreditCardOutlined />,
    label: "Paiement",
    module: "paiement",
  },
  {
    key: "/dashboard/firmware",
    icon: <CloudDownloadOutlined />,
    label: "Firmware",
    module: "firmware",
  },
  {
    key: "/dashboard/audit",
    icon: <SafetyOutlined />,
    label: "Journal d'audit",
    module: "audit",
  },
  {
    key: "/dashboard/parametres",
    icon: <SettingOutlined />,
    label: "Paramètres",
  },
  {
    key: "/dashboard/simulator",
    icon: <AndroidOutlined />,
    label: "Simulateur",
    module: "simulateur",
  },
];

const titles: Record<string, string> = {
  "/dashboard": "Tableau de bord",
  "/dashboard/bornes": "Gestion des bornes",
  "/dashboard/sessions": "Sessions de recharge",
  "/dashboard/utilisateurs": "Utilisateurs",
  "/dashboard/vehicules": "Véhicules",
  "/dashboard/maintenance": "Maintenance",
  "/dashboard/alertes": "Alertes",
  "/dashboard/rapports": "Rapports",
  "/dashboard/documents": "Gestion documentaire",
  "/dashboard/paiement": "Paiement et facturation",
  "/dashboard/firmware": "Gestion firmware",
  "/dashboard/audit": "Journal d'audit",
  "/dashboard/parametres": "Paramètres",
  "/dashboard/simulator": "Simulateur OCPP",
};

const MOBILE_BREAKPOINT = 900;

function AdminLayout() {
  // Desktop: true/false toggles the icon-rail collapse. Mobile: true/false
  // toggles the off-canvas drawer (see the max-width:900px rules in AdminLayout.css).
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth > MOBILE_BREAKPOINT,
  );
  const { user, logout, can } = useAuth()
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo(
    () => allItems.filter((item) => !item.module || can(item.module)),
    [can],
  );

  const selectedKey = useMemo(() => {
    const match = Object.keys(titles)
      .sort((a, b) => b.length - a.length)
      .find((path) => location.pathname.startsWith(path));
    return match ?? "/dashboard";
  }, [location.pathname]);

  const unreadAlerts = alertes.filter((a) => !a.lue).length;

  const userMenu: MenuProps["items"] = [
    { key: "profile", icon: <UserOutlined />, label: "Mon profil" },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Déconnexion",
      danger: true,
    },
  ];

  function handleUserMenuClick({ key }: { key: string }) {
    if (key === "logout") {
      logout()
      return
    }

    if (key === "profile") {
      navigate("/dashboard/parametres")
    }
  }

  const avatarText = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AD";

  return (
    <Layout className="admin-layout">
      <div
        className={`admin-sider-backdrop ${sidebarOpen ? "admin-sider-backdrop--show" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <Sider
        className={`admin-sider ${sidebarOpen ? "admin-sider--open" : ""}`}
        collapsed={!sidebarOpen}
        collapsible
        trigger={null}
        width={240}
      >
        <Link to="/" className="admin-sider__logo">
          <span className="admin-sider__logo-badge">
            <ThunderboltOutlined />
          </span>
          {sidebarOpen && (
            <span className="admin-sider__logo-text">BornElect</span>
          )}
        </Link>

        <Menu
          className="admin-sider__menu"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={items}
          onClick={({ key }) => {
            navigate(key);
            if (window.innerWidth <= MOBILE_BREAKPOINT) setSidebarOpen(false);
          }}
        />
      </Sider>

      <Layout>
        <Header className="admin-header">
          <button
            type="button"
            className="admin-header__collapse"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Afficher/masquer le menu"
          >
            {sidebarOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
          </button>

          <h1 className="admin-header__title">{titles[selectedKey]}</h1>

          <div className="admin-header__actions">
            <Input
              className="admin-header__search"
              prefix={<SearchOutlined />}
              placeholder="Rechercher une borne, un utilisateur…"
            />
            <Link to="/dashboard/alertes" className="admin-header__bell">
              <Badge count={unreadAlerts} size="small" offset={[-2, 2]}>
                <BellOutlined />
              </Badge>
            </Link>
            <Dropdown menu={{ items: userMenu, onClick: handleUserMenuClick }} trigger={["click"]}>
              <div className="admin-header__user">
                <Avatar
                  size={34}
                  style={{ background: "var(--accent)", color: "#06170c" }}
                >
                  {avatarText}
                </Avatar>
                <div className="admin-header__user-meta">
                  <strong>{user?.name ?? "Administrateur"}</strong>
                  <span>{user?.role ?? "Super Administrateur"}</span>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default AdminLayout;
