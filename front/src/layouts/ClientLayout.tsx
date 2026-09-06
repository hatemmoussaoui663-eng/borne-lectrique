import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Layout, Menu, Avatar, Dropdown } from "antd";
import type { MenuProps } from "antd";
import {
  ThunderboltOutlined,
  CarOutlined,
  HistoryOutlined,
  IdcardOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  AimOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import "../styles/admin-shared.css";
import "./AdminLayout.css";

const { Sider, Header, Content } = Layout;

const items: MenuProps["items"] = [
  { key: "/client", icon: <ThunderboltOutlined />, label: "Bornes disponibles" },
  { key: "/client/vehicules", icon: <CarOutlined />, label: "Mes véhicules" },
  { key: "/client/suivi", icon: <AimOutlined />, label: "Suivi de ma voiture" },
  { key: "/client/historique", icon: <HistoryOutlined />, label: "Mon historique" },
  { key: "/client/badge", icon: <IdcardOutlined />, label: "Mon badge RFID" },
  {
    key: "/client/simulateur",
    icon: <ExperimentOutlined />,
    label: "Simulateur de recharge",
  },
  { key: "/client/factures", icon: <FileTextOutlined />, label: "Mes factures" },
];

const titles: Record<string, string> = {
  "/client": "Bornes disponibles",
  "/client/vehicules": "Mes véhicules",
  "/client/suivi": "Suivi GPS de ma voiture",
  "/client/historique": "Mon historique de recharge",
  "/client/badge": "Mon badge RFID",
  "/client/simulateur": "Simulateur de recharge",
  "/client/factures": "Mes factures et mon porte-monnaie",
};

const MOBILE_BREAKPOINT = 900;

function ClientLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth > MOBILE_BREAKPOINT,
  );
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = useMemo(() => {
    const match = Object.keys(titles)
      .sort((a, b) => b.length - a.length)
      .find((path) => location.pathname.startsWith(path));
    return match ?? "/client";
  }, [location.pathname]);

  const userMenu: MenuProps["items"] = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Déconnexion",
      danger: true,
    },
  ];

  const avatarText = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "CL";

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
            <Dropdown menu={{ items: userMenu, onClick: () => void logout() }} trigger={["click"]}>
              <div className="admin-header__user">
                <Avatar
                  size={34}
                  style={{ background: "var(--accent)", color: "#06170c" }}
                >
                  {avatarText}
                </Avatar>
                <div className="admin-header__user-meta">
                  <strong>{user?.name ?? "Client"}</strong>
                  <span>{user?.role ?? "Client"}</span>
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

export default ClientLayout;
