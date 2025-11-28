import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/components/theme-provider";
import { useCurrency } from "../components/CurrencyContext";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { currency: contextCurrency } = useCurrency();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        setLoading(false);
        return;
      }
      setUser(session.user);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();
      setProfile(profileData);

      // Totals
      const { data: expenses } = await supabase
        .from("expenses")
        .select("amount")
        .eq("user_id", session.user.id);
      const { data: incomes } = await supabase
        .from("income")
        .select("amount")
        .eq("user_id", session.user.id);
      setTotalExpenses((expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0));
      setTotalIncome((incomes || []).reduce((sum, i) => sum + Number(i.amount || 0), 0));

      setLoading(false);
    }
    loadProfile();
  }, [navigate]);

  if (loading) {
    return (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
      }}>
        Loading profile...
      </div>
    );
  }

  if (!profile || !user) {
    return (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: "#c00",
        fontSize: 18,
      }}>
        Profile not found.
      </div>
    );
  }

  // Helper for nice label names
  const displayLabel = (field) => ({
    name: "Full Name",
    username: "Username",
    email: "Email",
    phone: "Phone",
    gender: "Gender",
    dob: "Date of Birth",
    language: "Language",
    currency: "Currency",
    default_category: "Default Category",
    budget_limit: "Budget Limit",
    reminders: "Reminders",
    monthly_report: "Monthly Summary",
    alert_large_tx: "Alert for Large Expenses",
    auto_categorize: "Auto-categorize",
    shared: "Shared/Family Account",
    two_fa: "2FA (Two-Factor Auth)",
    avatar_url: "Profile Picture"
  }[field] || field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));

  function formatJoinDate(str) {
    if (!str) return "";
    const d = new Date(str);
    return `${d.getDate().toString().padStart(2, '0')}/${
      (d.getMonth() + 1).toString().padStart(2, '0')}/${
      d.getFullYear()}`;
  }

  const balance = totalIncome - totalExpenses;

  // Pick useful fields to display from the profile object
  const showFields = [
    "username",
    "phone",
    "gender",
    "dob",
    "language",
    "currency",
    "default_category",
    "budget_limit",
    "reminders",
    "monthly_report",
    "alert_large_tx",
    "auto_categorize",
    "shared",
    "two_fa"
  ];

  return (
    <div style={{
      maxWidth: 500, margin: "48px auto", padding: 32,
      borderRadius: 18, boxShadow: theme === 'dark' ? "0 3px 24px #000a" : "0 2px 18px #201a",
      background: theme === 'dark' ? "#181825" : "#fff"
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <img
          src={profile.avatar_url || "/default-avatar.png"}
          alt="Profile"
          style={{
            width: 100, height: 100, borderRadius: "50%",
            border: `2px solid ${theme === 'dark' ? "#333a6a" : "#3366ee"}`,
            objectFit: "cover", background: "#201a30"
          }}
          onError={e => { e.currentTarget.src = "/default-avatar.png"; }}
        />
        <div style={{ fontWeight: "bold", fontSize: 26, marginTop: 4 }}>
          {profile.name || profile.username || user.email || "User"}
        </div>
        <div style={{ fontSize: 16, color: "#a3a1bd" }}>{user.email}</div>
      </div>
      <div style={{
        fontSize: 17, lineHeight: 1.8, margin: "18px 0 4px 0",
        color: theme === 'dark' ? "#eee" : "#232427"
      }}>
        <div><b>Joined:</b> {formatJoinDate(user.created_at)}</div>
        {/* Dynamically display fields from profile */}
        {showFields.map(field => (
          profile[field] !== undefined && profile[field] !== null && profile[field] !== "" && (
            <div key={field}>
              <b>{displayLabel(field)}:</b> {typeof profile[field] === "boolean" ? (profile[field] ? "Yes" : "No") : profile[field]}
            </div>
          )
        ))}
        <hr style={{ margin: "18px 0", border: 0, borderTop: theme === "dark" ? "1px solid #222537" : "1px solid #e3e0fe" }}/>
        <div><b>Total Income:</b> <span style={{ color: "#42e589" }}>{profile.currency || contextCurrency}{totalIncome.toLocaleString()}</span></div>
        <div><b>Total Expenses:</b> <span style={{ color: "#ff6262" }}>{profile.currency || contextCurrency}{totalExpenses.toLocaleString()}</span></div>
        <div>
          <b>Balance:</b> <span style={{ color: balance >= 0 ? "#87b7ff" : "#ff6262" }}>
            {profile.currency || contextCurrency}{balance.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
