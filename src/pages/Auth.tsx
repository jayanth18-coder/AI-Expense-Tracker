import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Eye, EyeOff } from "lucide-react";

const FIELD_STYLE = {
  width: "100%",
  background: "#17181D",
  color: "#fff",
  borderRadius: "8px",
  border: "1px solid #222",
  height: "40px",
  paddingLeft: "10px",
  paddingRight: "10px",
  boxSizing: "border-box",
} as const;

export default function Auth() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [errorMessage, setErrorMessage] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");

  // Only navigate after auth state changes (e.g. successful login),
  // do NOT auto-redirect on initial page load.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setVerifyMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password: signInPassword,
      });
      if (error) {
        setErrorMessage("Invalid credentials");
        setIsLoading(false);
        return;
      }
      // onAuthStateChange will redirect; this is optional:
      navigate("/dashboard");
    } catch (_error) {
      setErrorMessage("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setVerifyMessage("");
    try {
      const { error, data } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/profile-create`,
        },
      });
      if (error) {
        setErrorMessage(error.message || "Failed to sign up");
        setIsLoading(false);
        return;
      }
      if (data.session) {
        // Only if email confirmation is off (instant session)
        navigate("/profile-create");
      } else {
        setVerifyMessage(
          "Account created! Please check your email and verify your account before continuing."
        );
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to sign up");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabClick = (tabName: "signin" | "signup") => {
    setTab(tabName);
    setErrorMessage("");
    setVerifyMessage("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#12121b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 410,
          maxWidth: "100vw",
          background: "#191924",
          borderRadius: 20,
          boxShadow: "0 12px 48px #12121b66",
          padding: 36,
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              margin: "0 auto 12px",
              width: 56,
              height: 56,
              borderRadius: 18,
              background: "linear-gradient(135deg, #9068f6 60%, #a18cff 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Wallet size={28} color="#fff" />
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              background: "linear-gradient(90deg, #a18cff 40%, #9068f6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Expense Tracker
          </div>
          <div
            style={{ fontSize: 15, color: "#b9bacb", marginBottom: 8 }}
          >
            Manage your finances with ease
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            marginBottom: 18,
            borderRadius: 9,
            background: "#181823",
            overflow: "hidden",
            boxShadow: "0 2px 20px #18182344",
          }}
        >
          <button
            style={{
              flex: 1,
              padding: "12px 8px",
              background: tab === "signin" ? "#27273B" : "transparent",
              color: tab === "signin" ? "#f8f8f8" : "#bbb",
              fontWeight: tab === "signin" ? 700 : 500,
              fontSize: 17,
              border: "none",
              outline: "none",
              cursor: "pointer",
            }}
            onClick={() => handleTabClick("signin")}
          >
            Sign In
          </button>
          <button
            style={{
              flex: 1,
              padding: "12px 8px",
              background: tab === "signup" ? "#27273B" : "transparent",
              color: tab === "signup" ? "#f8f8f8" : "#bbb",
              fontWeight: tab === "signup" ? 700 : 500,
              fontSize: 17,
              border: "none",
              outline: "none",
              cursor: "pointer",
            }}
            onClick={() => handleTabClick("signup")}
          >
            Sign Up
          </button>
        </div>

        {verifyMessage && (
          <div
            style={{
              marginBottom: 18,
              background: "#1e233e",
              borderRadius: 7,
              color: "#9ee29d",
              padding: "14px 10px 14px 10px",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            {verifyMessage}
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              color: "#f37272",
              fontWeight: 600,
              marginBottom: 14,
            }}
          >
            {errorMessage}
          </div>
        )}

        {tab === "signin" && (
          <form onSubmit={handleSignIn}>
            <div style={{ textAlign: "left", marginBottom: 12 }}>
              <label
                htmlFor="signin-email"
                style={{ fontWeight: 600, color: "#bbb" }}
              >
                Email
              </label>
              <input
                id="signin-email"
                type="email"
                placeholder="Enter Your E-mail"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                autoComplete="username"
                required
                style={{
                  ...FIELD_STYLE,
                  marginBottom: 14,
                }}
              />
            </div>
            <div style={{ textAlign: "left", marginBottom: 20 }}>
              <label
                htmlFor="signin-password"
                style={{ fontWeight: 600, color: "#bbb" }}
              >
                Password
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  id="signin-password"
                  type={showSignInPassword ? "text" : "password"}
                  placeholder="Enter Your Password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  style={{ ...FIELD_STYLE, marginBottom: 0 }}
                />
                <button
                  type="button"
                  aria-label={
                    showSignInPassword ? "Hide password" : "Show password"
                  }
                  onClick={() =>
                    setShowSignInPassword((v) => !v)
                  }
                  style={{
                    height: 40,
                    width: 40,
                    borderRadius: 8,
                    border: "1px solid #252537",
                    background: "#181823",
                    color: "#ccc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  {showSignInPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>
            <button
              style={{
                width: "100%",
                padding: "12px 0",
                marginTop: 8,
                background:
                  "linear-gradient(90deg, #a18cff 40%, #9068f6 100%)",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 17,
                color: "#fafafa",
                cursor: "pointer",
              }}
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        {tab === "signup" && (
          <form onSubmit={handleSignUp}>
            <div style={{ textAlign: "left", marginBottom: 12 }}>
              <label
                htmlFor="signup-email"
                style={{ fontWeight: 600, color: "#bbb" }}
              >
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                placeholder="Enter Your E-mail"
                value={signUpEmail}
                autoComplete="username"
                onChange={(e) => setSignUpEmail(e.target.value)}
                required
                style={{
                  ...FIELD_STYLE,
                  marginBottom: 14,
                }}
              />
            </div>
            <div style={{ textAlign: "left", marginBottom: 20 }}>
              <label
                htmlFor="signup-password"
                style={{ fontWeight: 600, color: "#bbb" }}
              >
                Password
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  id="signup-password"
                  type={showSignUpPassword ? "text" : "password"}
                  placeholder="Enter Your Password"
                  value={signUpPassword}
                  minLength={6}
                  autoComplete="new-password"
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  required
                  style={{ ...FIELD_STYLE, marginBottom: 0 }}
                />
                <button
                  type="button"
                  aria-label={
                    showSignUpPassword ? "Hide password" : "Show password"
                  }
                  onClick={() =>
                    setShowSignUpPassword((v) => !v)
                  }
                  style={{
                    height: 34,
                    width: 34,
                    borderRadius: 8,
                    border: "1px solid #252537",
                    background: "#181823",
                    color: "#ccc",
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  {showSignUpPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>
            </div>
            <button
              style={{
                width: "100%",
                padding: "7px 0",
                marginTop: 8,
                background:
                  "linear-gradient(90deg, #a18cff 40%, #9068f6 100%)",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 16,
                color: "#fafafa",
                cursor: "pointer",
              }}
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Creating account..." : "Sign Up"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
