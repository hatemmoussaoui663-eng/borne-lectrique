import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Input, message } from "antd";
import {
  ThunderboltFilled,
  MailOutlined,
  LockOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState("admin@bornelect.tn");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password)
      message.success("Connexion réussie");
    } catch (error: unknown) {
      const responseMessage =
        error && typeof error === "object" && "response" in error && error.response && typeof error.response === "object" && "data" in error.response && error.response.data && typeof error.response.data === "object" && "message" in error.response.data
          ? String(error.response.data.message)
          : "Échec de la connexion";
      message.error(responseMessage);
    } finally {
      setLoading(false);
    }
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
          <Link to="/forgot-password">Mot de passe oublié ?</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
