import { User, LogOut, LayoutDashboard, Receipt, Download, Settings } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "../components/CurrencyContext";
import fontDataString from "../fonts/NotoSans-Italic-VariableFont_wdth,wght-normal.js";
import { Link } from "react-router-dom";
const fontName = "NotoSans-Italic-VariableFont_wdth,wght";

const sidebarLinks = [
  { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={26} /> },
  { to: "/profile", label: "Profile", icon: <User size={26} /> },
  // ROUTING, NOT ACTION BUTTON!
  { to: "/ai-expense-sync", label: "AI Expense Sync", icon: <Receipt size={26} /> },
  { to: "/settings", label: "Settings", icon: <Settings size={26} /> },
  // ONLY Export Data is a button with logic
  { to: "#", label: "Export Data", icon: <Download size={26} />, onClick: null }
];

export default function Sidebar({
  user,
  profile,
  open,
  onClose,
  theme,
  onSignOut
}) {
  const { currency } = useCurrency();

  // Attach export handler only to Export Data
  const links = sidebarLinks.map(link =>
    link.label === "Export Data"
      ? { ...link, onClick: handleExportData }
      : link
  );

  const avatarUrl = profile?.avatar_url || user?.avatarUrl || null;
  const avatarAlt = profile?.name || user?.name || "User";
  const displayName = profile?.name ? profile.name : (user?.name || user?.email || "User");
  const initial = displayName ? displayName[0].toUpperCase() : "U";

  // Unicode PDF Export Handler
  const fetchAndExportPdf = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return alert("Sign in required.");

    const { data: expenses = [] } = await supabase.from("expenses").select("*").eq("user_id", userId);
    const { data: incomes = [] } = await supabase.from("income").select("*").eq("user_id", userId);

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.addFileToVFS(fontName + ".ttf", fontDataString);
    doc.addFont(fontName + ".ttf", fontName, "normal");
    doc.setFont(fontName, "normal");
    doc.setFontSize(22);
    doc.text("Expenses", 40, 60);

    autoTable(doc, {
      startY: 78,
      margin: { left: 40, right: 40 },
      tableWidth: 'auto',
      head: [["Date", "Time", "Category", "Amount", "Description"]],
      body: expenses.map(e => [
        e.date?.split("T")[0] || e.date || "",
        (e.date?.split("T")[1] || e.time || "").slice(0, 5),
        e.category,
        `${currency}${Number(e.amount ?? 0).toLocaleString()}`,
        e.description || ""
      ]),
      headStyles: {
        fillColor: [24, 35, 61], textColor: 255, fontSize: 13, fontStyle: 'bold', halign: 'center', font: fontName
      },
      styles: { font: fontName, fontSize: 12, halign: 'center', cellPadding: 7, minCellWidth: 70 },
      alternateRowStyles: { fillColor: [245, 245, 245], textColor: 20 }
    });

    let afterExpenses = doc.lastAutoTable.finalY + 16;
    doc.setFontSize(22);
    doc.text("Income", 40, afterExpenses);

    autoTable(doc, {
      startY: afterExpenses + 18,
      margin: { left: 40, right: 40 },
      tableWidth: 'auto',
      head: [["Date", "Time", "Category", "Amount", "Description"]],
      body: incomes.map(i => [
        i.date?.split("T")[0] || i.date || "",
        (i.date?.split("T")[1] || i.time || "").slice(0, 5),
        i.category,
        `${currency}${Number(i.amount ?? 0).toLocaleString()}`,
        i.description || ""
      ]),
      headStyles: {
        fillColor: [25, 174, 54], textColor: 255, fontSize: 13, fontStyle: 'bold', halign: 'center', font: fontName
      },
      styles: { font: fontName, fontSize: 12, halign: 'center', cellPadding: 7, minCellWidth: 70 },
      alternateRowStyles: { fillColor: [245, 245, 245], textColor: 20 }
    });

    doc.save("expenses_incomes.pdf");
  };

  function handleExportData(e) {
    e.preventDefault();
    fetchAndExportPdf();
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-40 md:bg-opacity-20"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 left-0 z-50 w-72 h-screen transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full"}
        ${theme === "dark" ? "bg-black text-white" : "bg-white text-black"}
        border-r border-zinc-800 shadow-xl flex flex-col`}
      >
        {/* Profile & Avatar */}
        <div className="flex items-center gap-4 px-6 py-6 border-b border-zinc-800">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={avatarAlt}
              className="w-14 h-14 rounded-full object-cover border-2 border-blue-700"
              style={{ background: "#222" }}
              onError={e => { e.currentTarget.src = "/default-avatar.png"; }}
            />
          ) : (
            <div
              className="flex items-center justify-center text-2xl font-bold"
              style={{
                background: theme === "dark" ? "#272986" : "#a4acf8",
                color: theme === "dark" ? "#fff" : "#222",
                border: theme === "dark" ? "2px solid #333a6a" : "2px solid #3366ee",
                borderRadius: "50%",
                aspectRatio: "1/1",
                minWidth: "56px",
                minHeight: "56px",
                width: "56px",
                height: "56px",
                overflow: "hidden",
              }}
            >
              {initial}
            </div>
          )}
          <div>
            <div className="font-semibold text-lg ">
              {displayName}
            </div>
          </div>
        </div>
        {/* Navigation */}
        <nav className="flex flex-col gap-2 px-5 py-5 text-lg flex-1">
          {links.map(link =>
            link.onClick ? (
              <a
                key={link.to + link.label}
                href="#"
                className={`flex items-center gap-4 px-4 py-3 rounded-lg transition
                  ${theme === "dark" ? "hover:bg-zinc-800" : "hover:bg-zinc-200"}
                  font-semibold text-lg`}
                onClick={e => {
                  onClose();
                  e.preventDefault();
                  link.onClick(e);
                }}
              >
                {link.icon}
                <span style={{ fontSize: "1.17em", fontWeight: 600 }}>{link.label}</span>
              </a>
            ) : (
              <Link
                key={link.to + link.label}
                to={link.to}
                className={`flex items-center gap-4 px-4 py-3 rounded-lg transition
                  ${theme === "dark" ? "hover:bg-zinc-800" : "hover:bg-zinc-200"}
                  font-semibold text-lg`}
                onClick={onClose}
              >
                {link.icon}
                <span style={{ fontSize: "1.17em", fontWeight: 600 }}>{link.label}</span>
              </Link>
            )
          )}
        </nav>
        {/* Sign Out */}
        <div className="px-5 pb-7 mt-auto">
          <button
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg font-bold transition
              text-lg ${theme === "dark" ? "bg-zinc-900 hover:bg-zinc-800 text-white" : "bg-zinc-200 hover:bg-zinc-300 text-black"}`}
            onClick={() => {
              if (onSignOut) onSignOut();
              onClose();
            }}
          >
            <LogOut size={26} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
