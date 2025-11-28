import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  LogOut,
  Plus,
  Sun,
  Moon,
  Menu,
  PieChart as PieChartIcon,
  LayoutDashboard,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import ExpenseChart from "@/components/ExpenseChart";
import MonthlyChart from "@/components/MonthlyChart";
import IncomeExpenseChart from "@/components/IncomeExpenseChart";
import { ExpenseForm } from "@/components/ExpenseForm";
import { IncomeForm } from "@/components/IncomeForm";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useCurrency } from "../components/CurrencyContext";

const LOGO_DATAURL = "data:image/png;base64,iVBORw0KGgoAAAANSUh...";

// !!! ---- Paste your font's base64 string below ---- !!!
const fontDataString = "AAEAAA..."; // Paste base64 string ONLY, no quotes or semicolon
const fontName =
  "NotoSans-Italic-VariableFont_wdth,wght"; // <-- Use name from your font's addFont registration

const Dashboard = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { currency } = useCurrency();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);

  useEffect(() => {
    async function checkSessionAndProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        setLoading(false);
        return;
      }
      setUser(session.user);
      let { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();
      if (!profileData || !profileData.name) {
        navigate("/profile-create");
        setLoading(false);
        return;
      }
      setProfile(profileData);
      setLoading(false);
    }
    checkSessionAndProfile();
  }, [navigate, refreshKey]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !user.id) return;
      let { data: expenseData } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", String(user.id));
      setExpenses(expenseData || []);
      let { data: incomeData } = await supabase
        .from("income")
        .select("*")
        .eq("user_id", String(user.id));
      setIncomes(incomeData || []);
    };
    fetchData();
  }, [user, refreshKey]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const handleDataUpdate = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // PDF Export using Unicode font (manual registration, ESM-safe!)
  const handleExportData = () => {
    const doc = new jsPDF();

    // Register the font data in jsPDF before use
    if (!(doc as any).getFontList()[fontName]) {
      (doc as any).addFileToVFS(fontName + ".ttf", fontDataString);
      (doc as any).addFont(fontName + ".ttf", fontName, "normal");
    }
    doc.setFont(fontName, "normal");

    if (LOGO_DATAURL && LOGO_DATAURL.startsWith("data:")) {
      try {
        (doc as any).addImage(LOGO_DATAURL, "PNG", 80, 8, 50, 16);
      } catch (e) {}
    }

    let y = 30;
    doc.setFontSize(16);
    doc.text("Expenses", 14, y);
    (autoTable as any)(doc, {
      head: [["Date", "Time", "Category", "Amount", "Description"]],
      body: expenses.map((exp: any) => {
        let date = exp.date;
        let time = "";
        if (date && date.includes("T")) {
          let timePart = date.split("T")[1] || "";
          time = timePart.slice(0, 5);
        } else if (typeof exp.time === "string" && exp.time) {
          time = exp.time;
        }
        // Use currency symbol!
        return [
          date ? date.split("T")[0] : date,
          time,
          exp.category,
          `${currency}${Number(exp.amount).toFixed(2)}`,
          exp.description ?? "",
        ];
      }),
      startY: y + 4,
      styles: { font: fontName, fontSize: 11 },
      headStyles: { fillColor: [30, 41, 59], font: fontName },
    });

    const afterExpenses = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(16);
    doc.text("Income", 14, afterExpenses);
    (autoTable as any)(doc, {
      head: [["Date", "Time", "Category", "Amount", "Description"]],
      body: incomes.map((inc: any) => {
        let date = inc.date;
        let time = "";
        if (date && date.includes("T")) {
          let timePart = date.split("T")[1] || "";
          time = timePart.slice(0, 5);
        } else if (typeof inc.time === "string" && inc.time) {
          time = inc.time;
        }
        return [
          date ? date.split("T")[0] : date,
          time,
          inc.category,
          `${currency}${Number(inc.amount).toFixed(2)}`,
          inc.description ?? "",
        ];
      }),
      startY: afterExpenses + 4,
      styles: { font: fontName, fontSize: 11 },
      headStyles: { fillColor: [14, 182, 95], font: fontName },
    });

    const userName = (profile as any)?.name || (user as any)?.email || "No Name";
    doc.setFontSize(12);
    doc.text(`Generated for user: ${userName}`, 14, 285);
    doc.save("expenses_incomes.pdf");
    toast.success("PDF exported successfully!");
  };

  const totalIncome = incomes.reduce(
    (sum, inc: any) => sum + Number(inc.amount || 0),
    0
  );
  const totalExpenses = expenses.reduce(
    (sum, exp: any) => sum + Number(exp.amount || 0),
    0
  );
  const balance = totalIncome - totalExpenses;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black dark:bg-black">
        <div className="animate-pulse text-lg text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        theme === "dark" ? "bg-black" : "bg-white"
      }`}
    >
      <Sidebar
        user={user}
        profile={profile}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        theme={theme}
        onSignOut={handleSignOut}
        handleExportData={handleExportData}
      />

      <header
        className={`border-b border-zinc-800 ${
          theme === "dark" ? "bg-black/80" : "bg-white/80"
        } backdrop-blur-sm sticky top-0 z-30`}
      >
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className={`p-2 rounded-lg focus:outline-none transition ${
                theme === "dark"
                  ? "text-white hover:bg-zinc-800"
                  : "text-black hover:bg-zinc-200"
              }`}
              style={{ background: "transparent", border: "none" }}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={28} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 to-purple-900 flex items-center justify-center">
              <Wallet
                className={`w-5 h-5 ${
                  theme === "dark" ? "text-white" : "text-black"
                }`}
              />
            </div>
            <h1
              className={`text-2xl font-bold ${
                theme === "dark" ? "text-white" : "text-black"
              }`}
            >
              Expense Tracker
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={theme === "dark" ? "text-white" : "text-black"}
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className={theme === "dark" ? "text-white" : "text-black"}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card
            className={`border-zinc-800 ${
              theme === "dark" ? "bg-black" : "bg-white"
            }`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle
                className={`text-sm font-medium ${
                  theme === "dark" ? "text-zinc-300" : "text-zinc-800"
                }`}
              >
                Total Income
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                {currency}
                {totalIncome.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card
            className={`border-zinc-800 ${
              theme === "dark" ? "bg-black" : "bg-white"
            }`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle
                className={`text-sm font-medium ${
                  theme === "dark" ? "text-zinc-300" : "text-zinc-800"
                }`}
              >
                Total Expenses
              </CardTitle>
              <TrendingDown className="w-4 h-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">
                {currency}
                {totalExpenses.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card
            className={`border-zinc-800 ${
              theme === "dark" ? "bg-black" : "bg-white"
            }`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle
                className={`text-sm font-medium ${
                  theme === "dark" ? "text-zinc-300" : "text-zinc-800"
                }`}
              >
                Balance
              </CardTitle>
              <Wallet className="w-4 h-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">
                {currency}
                {balance.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4 mb-8">
          <Button
            onClick={() => setShowExpenseForm(true)}
            className="bg-blue-700 hover:opacity-90 text-white font-bold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
          <Button
            onClick={() => setShowIncomeForm(true)}
            className="bg-green-600 hover:opacity-90 text-white font-bold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Income
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card
            className={`border-zinc-800 ${
              theme === "dark" ? "bg-black" : "bg-white"
            }`}
          >
            <CardHeader>
              <CardTitle
                className={`flex items-center gap-2 ${
                  theme === "dark" ? "text-white" : "text-black"
                }`}
              >
                <PieChartIcon className="w-5 h-5" />
                By Category
              </CardTitle>
              <CardDescription
                className={
                  theme === "dark" ? "text-zinc-400" : "text-zinc-600"
                }
              >
                Your spending breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseChart
                expenses={expenses}
                theme={theme}
                currency={currency}
              />
            </CardContent>
          </Card>

          <Card
            className={`border-zinc-800 ${
              theme === "dark" ? "bg-black" : "bg-white"
            }`}
          >
            <CardHeader>
              <CardTitle
                className={theme === "dark" ? "text-white" : "text-black"}
              >
                Monthly Spending
              </CardTitle>
              <CardDescription
                className={
                  theme === "dark" ? "text-zinc-400" : "text-zinc-600"
                }
              >
                Track your monthly expenses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MonthlyChart
                expenses={expenses}
                theme={theme}
                currency={currency}
              />
            </CardContent>
          </Card>

          <Card
            className={`border-zinc-800 ${
              theme === "dark" ? "bg-black" : "bg-white"
            } lg:col-span-2`}
          >
            <CardHeader>
              <CardTitle
                className={theme === "dark" ? "text-white" : "text-black"}
              >
                Income vs Expenses
              </CardTitle>
              <CardDescription
                className={
                  theme === "dark" ? "text-zinc-400" : "text-zinc-600"
                }
              >
                Compare your earnings and spending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncomeExpenseChart
                expenses={expenses}
                incomes={incomes}
                theme={theme}
                currency={currency}
              />
            </CardContent>
          </Card>
        </div>
      </main>

      <ExpenseForm
        open={showExpenseForm}
        onOpenChange={setShowExpenseForm}
        onSuccess={handleDataUpdate}
      />
      <IncomeForm
        open={showIncomeForm}
        onOpenChange={setShowIncomeForm}
        onSuccess={handleDataUpdate}
      />
    </div>
  );
};

export default Dashboard;
