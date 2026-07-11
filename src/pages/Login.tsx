import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "antd";
import {
  ThunderboltFilled,
  MailOutlined,
  LockOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import "./Login.css";

// No backend yet — any credentials just simulate a session and continue
// to the admin dashboard (see Module 1 · Authentification in the cahier des charges).
function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@bornelect.tn");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => navigate("/dashboard"), 500);
  }

  return (
    <div className="login">
      <div className="login__glow" aria-hidden="true" />
      <form className="login__card" onSubmit={handleSubmit}>
        <div className="login__logo">
          <span className="login__logo-badge">
            <ThunderboltFilled />
          </span>
          <span className="login__logo-text">BornElect</span>
        </div>

        <h1 className="login__title">Connexion</h1>
        <p className="login__subtitle">
          Accédez à la supervision de votre réseau de bornes de recharge.
        </p>

        <label className="login__label" htmlFor="email">
          Adresse e-mail
        </label>
        <Input
          id="email"
          size="large"
          prefix={<MailOutlined />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="login__label" htmlFor="password">
          Mot de passe
        </label>
        <Input.Password
          id="password"
          size="large"
          prefix={<LockOutlined />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        <Button
          htmlType="submit"
          type="primary"
          size="large"
          block
          loading={loading}
          className="login__submit"
        >
          Se connecter <ArrowRightOutlined />
        </Button>

        <p className="login__hint">
          Démo sans backend — n'importe quel identifiant vous connecte au
          tableau de bord.
        </p>
      </form>
    </div>
  );
}

export default Login;
