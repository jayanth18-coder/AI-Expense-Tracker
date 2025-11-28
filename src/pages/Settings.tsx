import React, { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useCurrency } from "../components/CurrencyContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// You must supply the font file side-by-side for Unicode PDF export:
import fontDataString from "../fonts/NotoSans-Italic-VariableFont_wdth,wght-normal.js";
const fontName = "NotoSans-Italic-VariableFont_wdth,wght";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // USER AND PROFILE
  const [user, setUser] = useState(null);

  // Local queued (new, unsaved) category adds
  const [pendingCategories, setPendingCategories] = useState([]);

  // DB categories
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [newType, setNewType] = useState("expense");

  // Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [pwChanging, setPwChanging] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  // PDF/CSV data
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);

  // Profile & basic settings
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState("English");
  const { currency, setCurrency } = useCurrency();
  const [alertLargeTx, setAlertLargeTx] = useState(true);
  const [monthlyReport, setMonthlyReport] = useState(false);
  const [reminders, setReminders] = useState(true);
  const [defaultCategory, setDefaultCategory] = useState("Food");
  const [budgetLimit, setBudgetLimit] = useState(25000);
  const [autoCategorize, setAutoCategorize] = useState(true);
  const [shared, setShared] = useState(false);
  const [twoFA, setTwoFA] = useState(false);

  const [initialSettings, setInitialSettings] = useState(null);
  const [settingsChanged, setSettingsChanged] = useState(false);

  useEffect(() => {
    async function loadAccountAndCategories() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      setUser(session.user);
      setEmail(session.user.email || "");
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (profileData && profileData.name) setUsername(profileData.name);
      setProfile(profileData);

      setLanguage(profileData.language || "English");
      setCurrency(profileData.currency || "₹");
      setAlertLargeTx(profileData.alert_large_tx ?? true);
      setMonthlyReport(profileData.monthly_report ?? false);
      setReminders(profileData.reminders ?? true);
      setDefaultCategory(profileData.default_category || "Food");
      setBudgetLimit(profileData.budget_limit ?? 25000);
      setAutoCategorize(profileData.auto_categorize ?? true);
      setShared(profileData.shared ?? false);
      setTwoFA(profileData.two_fa ?? false);

      setInitialSettings({
        language: profileData.language || "English",
        currency: profileData.currency || "₹",
        alertLargeTx: profileData.alert_large_tx ?? true,
        monthlyReport: profileData.monthly_report ?? false,
        reminders: profileData.reminders ?? true,
        defaultCategory: profileData.default_category || "Food",
        budgetLimit: profileData.budget_limit ?? 25000,
        autoCategorize: profileData.auto_categorize ?? true,
        shared: profileData.shared ?? false,
        twoFA: profileData.two_fa ?? false
      });

      const { data: catData } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", session.user.id);
      setCategories(catData || []);

      // Fetch expenses and income for PDF/CSV export
      const { data: expenseRows } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false });
      setExpenses(expenseRows || []);
      const { data: incomeRows } = await supabase
        .from("income")
        .select("*")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false });
      setIncome(incomeRows || []);

      setLoading(false);
    }
    loadAccountAndCategories();
  }, []);

  useEffect(() => {
    setSettingsChanged(
      pendingCategories.length > 0 ||
      (initialSettings &&
        (
          language !== initialSettings.language ||
          currency !== initialSettings.currency ||
          alertLargeTx !== initialSettings.alertLargeTx ||
          monthlyReport !== initialSettings.monthlyReport ||
          reminders !== initialSettings.reminders ||
          defaultCategory !== initialSettings.defaultCategory ||
          budgetLimit !== initialSettings.budgetLimit ||
          autoCategorize !== initialSettings.autoCategorize ||
          shared !== initialSettings.shared ||
          twoFA !== initialSettings.twoFA
        )
      )
    );
  }, [
    language, currency, alertLargeTx, monthlyReport, reminders,
    defaultCategory, budgetLimit, autoCategorize, shared, twoFA,
    pendingCategories.length, initialSettings
  ]);

  function handleQueueNewCategory(e) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    setPendingCategories(pendingCategories.concat([{
      name: newCategory.trim(),
      type: newType
    }]));
    setNewCategory("");
    setNewType("expense");
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Update settings if changed
    let needProfileUpdate = false;
    const updates = {};
    if (language !== initialSettings.language) { updates.language = language; needProfileUpdate = true; }
    if (currency !== initialSettings.currency) { updates.currency = currency; needProfileUpdate = true; }
    if (alertLargeTx !== initialSettings.alertLargeTx) { updates.alert_large_tx = alertLargeTx; needProfileUpdate = true; }
    if (monthlyReport !== initialSettings.monthlyReport) { updates.monthly_report = monthlyReport; needProfileUpdate = true; }
    if (reminders !== initialSettings.reminders) { updates.reminders = reminders; needProfileUpdate = true; }
    if (defaultCategory !== initialSettings.defaultCategory) { updates.default_category = defaultCategory; needProfileUpdate = true; }
    if (budgetLimit !== initialSettings.budgetLimit) { updates.budget_limit = budgetLimit; needProfileUpdate = true; }
    if (autoCategorize !== initialSettings.autoCategorize) { updates.auto_categorize = autoCategorize; needProfileUpdate = true; }
    if (shared !== initialSettings.shared) { updates.shared = shared; needProfileUpdate = true; }
    if (twoFA !== initialSettings.twoFA) { updates.two_fa = twoFA; needProfileUpdate = true; }

    if (needProfileUpdate) {
      await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id);
    }

    // Insert pending categories
    if (pendingCategories.length) {
      const inserts = pendingCategories.map(cat => ({
        user_id: user.id,
        name: cat.name,
        type: cat.type
      }));
      await supabase.from("categories").insert(inserts);
      setPendingCategories([]);
    }

    setLoading(false);
    navigate("/dashboard");
  };

  const handleCancel = () => {
    setPendingCategories([]);
    setLoading(true);
    window.location.reload();
  };

  // Password change logic
  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);
    if (!newPassword || newPassword.length < 6) {
      setPwError("Password must be at least 6 characters.");
      return;
    }
    setPwChanging(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwChanging(false);
    if (error) setPwError(error.message || "Password change failed.");
    else {
      setPwSuccess(true);
      setShowPasswordModal(false);
      setNewPassword("");
    }
  }

  // CSV Export
  const handleExportCSV = () => {
    let csv = "";
    csv += "Expenses\nDate,Time,Category,Amount,Description\n";
    expenses.forEach(e => {
      const dt = splitDateTime(e.date, e.time, e.date_column);
      csv += `${dt.date},${dt.time},${e.category},${e.amount},${e.description || ""}\n`;
    });
    csv += "\nIncome\nDate,Time,Category,Amount,Description\n";
    income.forEach(i => {
      const dt = splitDateTime(i.date, i.time, i.date_column);
      csv += `${dt.date},${dt.time},${i.category},${i.amount},${i.description || ""}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "expenses_incomes.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginLeft = 40;
    const sectionSpacing = 30;
    let y = 60;

    doc.addFileToVFS(fontName + ".ttf", fontDataString);
    doc.addFont(fontName + ".ttf", fontName, "normal");
    doc.setFont(fontName, "normal");

    doc.setFontSize(22);
    doc.text("Expenses", marginLeft, y);

    autoTable(doc, {
      startY: y + 20,
      margin: { left: marginLeft, right: marginLeft },
      tableWidth: 'auto',
      head: [["Date", "Time", "Category", "Amount", "Description"]],
      body: expenses.map(e => {
        const dt = splitDateTime(e.date, e.time, e.date_column);
        return [dt.date, dt.time, e.category, `${currency}${e.amount}`, e.description || ""];
      }),
      headStyles: {
        fillColor: [24, 35, 61], textColor: 255, fontSize: 13, fontStyle: 'bold', halign: 'center', font: fontName
      },
      styles: { font: fontName, fontSize: 12, halign: 'center', cellPadding: 7, minCellWidth: 70 },
      alternateRowStyles: { fillColor: [245, 245, 245], textColor: 20 },
    });

    y = doc.lastAutoTable.finalY + sectionSpacing;
    doc.setFontSize(22);
    doc.text("Income", marginLeft, y);

    autoTable(doc, {
      startY: y + 20,
      margin: { left: marginLeft, right: marginLeft },
      tableWidth: 'auto',
      head: [["Date", "Time", "Category", "Amount", "Description"]],
      body: income.map(i => {
        const dt = splitDateTime(i.date, i.time, i.date_column);
        return [dt.date, dt.time, i.category, `${currency}${i.amount}`, i.description || ""];
      }),
      headStyles: {
        fillColor: [25, 174, 54], textColor: 255, fontSize: 13, fontStyle: 'bold', halign: 'center', font: fontName
      },
      styles: { font: fontName, fontSize: 12, halign: 'center', cellPadding: 7, minCellWidth: 70 },
      alternateRowStyles: { fillColor: [245, 245, 245], textColor: 20 },
    });
    doc.save("expenses_incomes.pdf");
  };

  function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  function splitDateTime(iso, fallbackTime, fallbackDate) {
    if (!iso && (fallbackDate || fallbackTime)) {
      return { date: fallbackDate || "", time: fallbackTime || "" };
    }
    if (!iso) return { date: "", time: "" };
    const [date, time] = iso.split("T");
    return { date: date || "", time: (time || "").slice(0, 5) };
  }

  const isDark = theme === "dark";
  const thColor = isDark ? "#a18cff" : "#3a268c";
  const pageBg = isDark ? "#0a0a0a" : "#f8f9fa";
  const tableBg = isDark ? "#111111" : "#fff";
  const textColor = isDark ? "#fff" : "#222";
  const labelColor = isDark ? "#bbb" : "#555";

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: pageBg,
        color: textColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", width: "100vw", background: pageBg,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 0"
    }}>
      <form
        style={{
          background: tableBg, borderRadius: 16,
          boxShadow: isDark ? "0 2px 18px #0008" : "0 2px 18px #1010130a",
          border: `1px solid ${isDark ? "#1f1f1f" : "#e5e7ea"}`,
          padding: 40, maxWidth: 850, width: "100%"
        }}
        onSubmit={handleSave}
      >
        <h1 style={{ textAlign: "center", color: thColor, marginBottom: 24 }}>Settings</h1>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" }}>
          <tbody>
            {/* Account Section */}
            <tr><th colSpan={2} style={{ color: thColor, fontSize: 18, textAlign: 'left', paddingBottom: 8 }}>Account</th></tr>
            <tr>
              <td style={{ color: labelColor }}>Username</td>
              <td><input value={username} style={inputBase(isDark)} readOnly /></td>
            </tr>
            <tr>
              <td style={{ color: labelColor }}>Email</td>
              <td>
                <input type="email" value={email} style={inputBase(isDark)} readOnly />
              </td>
            </tr>
            {/* Change Password button */}
            <tr>
              <td></td>
              <td style={{ display: 'flex', alignItems: "center" }}>
                <button type="button"
                  style={{
                    ...miniBtn(isDark),
                    width: 170,
                    marginTop: 2,
                    marginBottom: 10,
                    fontWeight: 600,
                    background: "#3b52eb",
                    color: "#fff"
                  }}
                  onClick={() => setShowPasswordModal(true)}>
                  Change Password
                </button>
              </td>
            </tr>
            {/* Preferences Section */}
            <tr><th colSpan={2} style={{ textAlign: 'left', color: thColor, fontSize: 18, padding: '18px 0 8px 0' }}>Preferences</th></tr>
            <tr><td style={{ color: labelColor }}>Language</td>
              <td>
                <select value={language}
                  onChange={e => setLanguage(e.target.value)}
                  style={inputBase(isDark)}>
                  <option>English</option>
                  <option>Kannada</option>
                  <option>Hindi</option>
                </select>
              </td>
            </tr>
            <tr><td style={{ color: labelColor }}>Currency</td>
              <td>
                <select value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  style={inputBase(isDark)}>
                  <option>₹</option>
                  <option>$</option>
                  <option>€</option>
                </select>
              </td>
            </tr>
            <tr><td style={{ color: labelColor }}>Theme</td>
              <td>
                <select value={theme}
                  onChange={e => setTheme(e.target.value)}
                  style={inputBase(isDark)}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </td>
            </tr>
            <tr>
              <td style={{ color: labelColor }}>Notifications</td>
              <td style={{ display: 'flex', gap: 24 }}>
                <label style={checkboxLabel(isDark)}>
                  <input type="checkbox" checked={alertLargeTx} onChange={() => setAlertLargeTx(v => !v)} /> Large Tx Alerts
                </label>
                <label style={checkboxLabel(isDark)}>
                  <input type="checkbox" checked={monthlyReport} onChange={() => setMonthlyReport(v => !v)} /> Monthly Report
                </label>
                <label style={checkboxLabel(isDark)}>
                  <input type="checkbox" checked={reminders} onChange={() => setReminders(v => !v)} /> Reminders
                </label>
              </td>
            </tr>
            {/* Expense Features Section */}
            <tr><th colSpan={2} style={{ color: thColor, fontSize: 18, textAlign: 'left', padding: '18px 0 8px 0' }}>Expense Features</th></tr>
            <tr>
              <td style={{ color: labelColor }}>Default Category</td>
              <td>
                <select value={defaultCategory}
                  onChange={e => setDefaultCategory(e.target.value)}
                  style={inputBase(isDark)}>
                  <option>Food</option>
                  <option>Bills</option>
                  <option>Shopping</option>
                  <option>Travel</option>
                </select>
              </td>
            </tr>
            <tr>
              <td style={{ color: labelColor }}>Budget Limit</td>
              <td>
                <input type="number" min={0} value={budgetLimit}
                  onChange={e => setBudgetLimit(Number(e.target.value))}
                  style={inputBase(isDark)}
                />
              </td>
            </tr>
            <tr>
              <td style={{ color: labelColor }}>Auto-categorize</td>
              <td>
                <input type="checkbox" checked={autoCategorize}
                  onChange={() => setAutoCategorize(v => !v)} />
              </td>
            </tr>
            <tr>
              <td style={{ color: labelColor }}>Shared Accounts/Family</td>
              <td>
                <input type="checkbox"
                  checked={shared}
                  onChange={() => setShared(v => !v)} />
              </td>
            </tr>
            {/* Category Management */}
            <tr>
              <th colSpan={2} style={{ color: thColor, fontSize: 18, textAlign: 'left', padding: '18px 0 8px 0' }}>Category Management</th>
            </tr>
            <tr>
              <td colSpan={2}>
                <form onSubmit={handleQueueNewCategory} style={{ marginBottom: 16, display: "flex", gap: 8 }}>
                  <input
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    placeholder="New category name"
                    style={inputBase(isDark)}
                  />
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                    style={inputBase(isDark)}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                  <button type="submit" style={miniBtn(isDark)}>Add</button>
                </form>

                {/* CSV/PDF Download buttons, full width, one under the other */}
                <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 10, width: 220 }}>
                  <button type="button" style={{
                    ...miniBtn(isDark),
                    minWidth: 160,
                    width: "100%",
                    background: "#2b6af4",
                    color: "#fff",
                    fontWeight: 500
                  }} onClick={handleExportCSV}>
                    Download CSV
                  </button>
                  <button type="button" style={{
                    ...miniBtn(isDark),
                    minWidth: 160,
                    width: "100%",
                    background: "#4a3bb7",
                    color: "#fff",
                    fontWeight: 500
                  }} onClick={handleExportPDF}>
                    Download PDF
                  </button>
                </div>

                <table style={{ width: "100%", marginBottom: 10 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Name</th>
                      <th style={{ textAlign: "left" }}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(c => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{capitalize(c.type)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
            {/* Security & Privacy */}
            <tr><th colSpan={2} style={{ color: thColor, fontSize: 18, textAlign: 'left', padding: '18px 0 8px 0' }}>Security & Privacy</th></tr>
            <tr>
              <td style={{ color: labelColor }}>Two-Factor Authentication (2FA)</td>
              <td>
                <input type="checkbox"
                  checked={twoFA}
                  onChange={() => setTwoFA(v => !v)}
                />
              </td>
            </tr>
            <tr>
              <td style={{ color: labelColor }}>Session Management</td>
              <td>
                <button type="button" style={miniBtn(isDark)}>View Devices</button>
              </td>
            </tr>
            <tr>
              <td style={{ color: labelColor }}>Privacy Controls</td>
              <td>
                <button type="button" style={miniBtn(isDark)}>Set Data Visibility</button>
                <button type="button" style={miniBtn(isDark)}>Delete Account</button>
              </td>
            </tr>
            {/* Support & Miscellaneous */}
            <tr><th colSpan={2} style={{ color: thColor, fontSize: 18, textAlign: 'left', padding: '18px 0 8px 0' }}>Support & Miscellaneous</th></tr>
            <tr>
              <td colSpan={2} style={{ textAlign: 'center', color: textColor }}>
                <button type="button" style={miniBtn(isDark)}>Help Center / FAQs</button>
                <button type="button" style={miniBtn(isDark)}>Contact Support</button>
                <button type="button" style={miniBtn(isDark)}>Send Feedback</button>
              </td>
            </tr>
            <tr>
              <td style={{ color: labelColor }}>App Version</td>
              <td style={{ color: textColor }}>1.0.0</td>
            </tr>
            <tr>
              <td style={{ color: labelColor }}>What's New</td>
              <td style={{ color: textColor }}>Budgeting improvements</td>
            </tr>
          </tbody>
        </table>
        <div style={{
          display: "flex", gap: 16, justifyContent: "center",
          marginTop: 40, flexWrap: "wrap"
        }}>
          <button type="submit"
            style={{
              ...saveBtnStyle,
              opacity: settingsChanged ? 1 : 0.4,
              filter: settingsChanged ? "none" : "grayscale(0.85)",
              pointerEvents: settingsChanged ? "auto" : "none"
            }}
            disabled={!settingsChanged}
          >
            Save Changes
          </button>
          <button type="button" style={cancelBtn(isDark)} onClick={handleCancel}>Cancel</button>
          <button type="button" style={logoutBtnStyle} onClick={() => {
            supabase.auth.signOut();
            navigate("/");
          }}>Log Out</button>
        </div>
      </form>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div style={{
          position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh",
          background: "#0008", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: tableBg, borderRadius: 12, padding: 28,
            minWidth: 280, maxWidth: 350
          }}>
            <h3 style={{ color: thColor, marginBottom: 16 }}>Change Password</h3>
            <form onSubmit={handlePasswordChange}>
              <input type="password" placeholder="New password" minLength={6}
                autoFocus value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputBase(isDark)} />
              {pwError && <div style={{ color: "#f34747", marginBottom: 8 }}>{pwError}</div>}
              {pwSuccess && <div style={{ color: "#34c759", marginBottom: 8 }}>Password changed!</div>}
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button type="submit" disabled={pwChanging} style={saveBtnStyle}>Change</button>
                <button type="button" style={cancelBtn(isDark)} onClick={() => setShowPasswordModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Style helpers
const inputBase = (isDark) => ({
  width: "100%",
  height: 36,
  background: isDark ? "#181923" : "#f6f7fb",
  color: isDark ? "#fff" : "#222",
  border: `1px solid ${isDark ? "#2a2a2a" : "#cdd1d4"}`,
  borderRadius: 8,
  fontSize: 15,
  paddingLeft: 9,
  marginBottom: 2,
});
const miniBtn = (isDark) => ({
  padding: "6px 16px",
  background: isDark ? "#222" : "#f6f7fb",
  borderRadius: 7,
  border: "none",
  marginRight: 6,
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
  marginTop: 3,
  color: isDark ? "#fff" : "#222",
});
const checkboxLabel = (isDark) => ({
  color: isDark ? "#aaa" : "#666",
  fontWeight: 500,
  fontSize: 14,
});
const saveBtnStyle = {
  padding: "12px 38px",
  background: "linear-gradient(90deg,#28253a,#22232e)",
  color: "#fff",
  fontWeight: 700,
  borderRadius: 8,
  border: "none",
  fontSize: 17,
  cursor: "pointer",
};
const cancelBtn = (isDark) => ({
  padding: "12px 24px",
  background: isDark ? "#16151e" : "#f6f7fb",
  color: isDark ? "#eee" : "#222",
  fontWeight: 700,
  borderRadius: 8,
  border: "none",
  fontSize: 15,
  cursor: "pointer",
});
const logoutBtnStyle = {
  padding: "12px 22px",
  background: "#222",
  color: "#fff",
  fontWeight: 700,
  borderRadius: 8,
  border: "none",
  fontSize: 15,
  cursor: "pointer",
};
