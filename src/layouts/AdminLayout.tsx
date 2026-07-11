import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
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

const items: MenuProps["items"] = [
  {
    key: "/dashboard",
    icon: <DashboardOutlined />,
    label: "Tableau de bord",
  },
  { key: "/dashboard/bornes", icon: <ThunderboltOutlined />, label: "Bornes" },
  { key: "/dashboard/sessions", icon: <HistoryOutlined />, label: "Sessions" },
  {
    key: "/dashboard/utilisateurs",
    icon: <TeamOutlined />,
    label: "Utilisateurs",
  },
  { key: "/dashboard/vehicules", icon: <CarOutlined />, label: "Véhicules" },
  {
    key: "/dashboard/maintenance",
    icon: <ToolOutlined />,
    label: "Maintenance",
  },
  { key: "/dashboard/alertes", icon: <BellOutlined />, label: "Alertes" },
  { key: "/dashboard/rapports", icon: <BarChartOutlined />, label: "Rapports" },
  {
    key: "/dashboard/parametres",
    icon: <SettingOutlined />,
    label: "Paramètres",
  },
  {
    key: "/dashboard/test",
    icon: <AndroidOutlined />,
    label: "TEST",
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
  "/dashboard/parametres": "Paramètres",
  "/dashboard/TEST": "test",
};

const MOBILE_BREAKPOINT = 900;

function AdminLayout() {
  // Desktop: true/false toggles the icon-rail collapse. Mobile: true/false
  // toggles the off-canvas drawer (see the max-width:900px rules in AdminLayout.css).
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth > MOBILE_BREAKPOINT,
  );
  const location = useLocation();
  const navigate = useNavigate();

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
            <Dropdown menu={{ items: userMenu }} trigger={["click"]}>
              <div className="admin-header__user">
                <Avatar
                  size={34}
                  style={{ background: "var(--accent)", color: "#06170c" }}
                >
                  SR
                </Avatar>
                <div className="admin-header__user-meta">
                  <strong>Sami Rekik</strong>
                  <span>Super Administrateur</span>
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
