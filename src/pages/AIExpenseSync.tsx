// src/pages/AIExpenseSync.tsx

import React, { useState } from "react";
import { Receipt, UploadCloud, Check, X } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import * as XLSX from "xlsx";
import { useTheme } from "@/components/theme-provider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `//cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

interface Expense {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  description: string;
  type: "debit" | "credit"; // debit = expense, credit = income
  flagged: boolean;
  reason?: string;
  include?: boolean;
}

interface ParsedResult {
  summary: {
    total: string;
    transactions: number;
    flagged: number;
    total_expense?: string;
    total_income?: string;
    net?: string;
  };
  flagged: Expense[];
  categories: { name: string; total: string }[];
  expenses: Expense[];
  unparsed?: string[];
}

// match your ExpenseForm categories
const EXPENSE_CATEGORIES = [
  "Fuel",
  "Food",
  "Bills",
  "EMI",
  "Health-Care",
  "Entertainment",
  "Travel",
  "Shopping",
  "Other",
];

// match your IncomeForm categories
const INCOME_CATEGORIES = [
  "Salary",
  "Interest",
  "Gift",
  "Refund",
  "Seller",
  "Other",
];

export default function AIExpenseSync() {
  const { theme } = useTheme();

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ParsedResult | null>(null);
  const [editingExpenses, setEditingExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);

  // chat state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Excel extraction (not used for PDF, but kept for future)
  const extractExcelData = async (file: File): Promise<string[][]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: string[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    return rows;
  };

  // PDF -> FastAPI (port 3002)
  const analyzePdfWithAI = async (file: File) => {
    const form = new FormData();
    form.append("file", file);

    const response = await fetch("http://localhost:3002/api/analyze-expenses", {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      throw new Error("AI analysis failed");
    }

    return (await response.json()) as ParsedResult;
  };

  // Excel -> (optional) FastAPI as JSON; same port 3002
  const analyzeExcelWithAI = async (rows: string[][]) => {
    const response = await fetch("http://localhost:3002/api/analyze-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: rows,
        fileType: "excel",
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error("AI analysis failed");
    }

    return (await response.json()) as ParsedResult;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadedFile(file);
    setResults(null);
    setEditingExpenses([]);
    setChatMessages([]);
    setIsProcessing(true);

    try {
      let analysisResult: ParsedResult;

      if (file.name.toLowerCase().endsWith(".pdf")) {
        analysisResult = await analyzePdfWithAI(file);
      } else if (
        file.name.toLowerCase().endsWith(".xlsx") ||
        file.name.toLowerCase().endsWith(".xls")
      ) {
        const rows = await extractExcelData(file);
        analysisResult = await analyzeExcelWithAI(rows);
      } else {
        throw new Error("Unsupported file format. Please upload PDF or Excel.");
      }

      const withInclude: Expense[] = (analysisResult.expenses || []).map(
        (e: Expense) => ({ ...e, include: false })
      );

      setResults(analysisResult);
      setEditingExpenses(withInclude);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCategoryChange = (id: string, newCategory: string) => {
    setEditingExpenses((prev) =>
      prev.map((exp) =>
        exp.id === id ? { ...exp, category: newCategory } : exp
      )
    );
  };

  const handleMerchantChange = (id: string, newMerchant: string) => {
    setEditingExpenses((prev) =>
      prev.map((exp) =>
        exp.id === id ? { ...exp, merchant: newMerchant } : exp
      )
    );
  };

  const handleIncludeToggle = (id: string, include: boolean) => {
    setEditingExpenses((prev) =>
      prev.map((exp) => (exp.id === id ? { ...exp, include } : exp))
    );
  };

  // convert DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD for Postgres
  const normalizeDate = (raw: string) => {
    const m = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (!m) return raw;
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  };

  // Import selected rows to dashboard DB (Node backend on 3001)
  const handleImportExpenses = async () => {
    try {
      const selected = editingExpenses.filter((exp) => exp.include);
      if (!selected.length) {
        throw new Error("No transactions selected");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !user.id) {
        throw new Error("Not authenticated");
      }
      const userId = user.id;

      const rowsToImport = selected.map((exp) => ({
        user_id: userId,
        date: normalizeDate(exp.date),
        merchant: exp.merchant,
        category: exp.category,
        amount: exp.amount,
        description: exp.description,
        type: exp.type === "debit" ? "expense" : "income",
      }));

      const response = await fetch(
        "http://localhost:3001/api/import-expenses",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: rowsToImport }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.insertedCount) {
        throw new Error(data?.message || "Nothing was imported");
      }

      toast.success("Transactions imported successfully!");
      setResults(null);
      setEditingExpenses([]);
      setUploadedFile(null);
      setChatMessages([]);
    } catch (err) {
      const msg = "Import Error: " + (err as Error).message;
      setError(msg);
      toast.error(msg);
    }
  };

  // AI chat handler
  const handleSendChat = async () => {
    if (!chatInput.trim()) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !user.id) {
        toast.error("You must be logged in to use the AI chat.");
        return;
      }

      const userMsg = { role: "user" as const, content: chatInput.trim() };
      setChatMessages((prev) => [...prev, userMsg]);
      setIsChatLoading(true);
      setChatInput("");

      const res = await fetch("http://localhost:3001/api/chat-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          question: userMsg.content,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.answer) {
        throw new Error(data?.message || "Chat failed");
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer as string },
      ]);
    } catch (err) {
      const msg = "Chat Error: " + (err as Error).message;
      toast.error(msg);
    } finally {
      setIsChatLoading(false);
    }
  };

  // theme-dependent classes
  const pageBg =
    theme === "dark" ? "from-zinc-900 to-zinc-800" : "from-zinc-100 to-zinc-300";

  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const mainText = theme === "dark" ? "text-zinc-100" : "text-zinc-800";
  const subText = theme === "dark" ? "text-zinc-300" : "text-zinc-600";
  const borderColor = theme === "dark" ? "border-zinc-700" : "border-zinc-200";
  const tableHeaderBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const tableHeaderText = theme === "dark" ? "text-zinc-100" : "text-zinc-900";
  const tableRowHover =
    theme === "dark" ? "hover:bg-zinc-800" : "hover:bg-zinc-100";

  return (
    <div
      className={`min-h-screen bg-gradient-to-br ${pageBg} px-4 sm:px-8 py-8`}
    >
      <div
        className={`max-w-6xl mx-auto ${cardBg} rounded-2xl shadow-lg py-10 px-6 border ${borderColor}`}
      >
        <div className="flex items-center gap-4 mb-7">
          <Receipt size={40} className="text-blue-500" />
          <h2 className={`font-extrabold text-3xl ${mainText}`}>
            AI Expense Sync
          </h2>
        </div>
        <p className={`text-lg mb-6 ${subText}`}>
          Upload your bank statement (PDF or Excel) and let the AI automatically
          extract, categorize, and highlight your expenses and income.
        </p>

        {/* Upload Area */}
        <div className="mb-8">
          <label
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition ${
              theme === "dark"
                ? "border-blue-400 hover:bg-zinc-900"
                : "border-blue-400 hover:bg-blue-50"
            }`}
          >
            <UploadCloud size={46} className="mb-3 text-blue-400" />
            <span className={`font-semibold text-lg mb-2 ${mainText}`}>
              Choose or drop your bank statement here
            </span>
            <span className={`text-sm ${subText}`}>
              Supported: PDF, Excel (.xlsx, .xls)
            </span>
            <input
              type="file"
              accept=".pdf,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 rounded-lg text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="text-lg text-blue-400 font-bold mb-6 text-center">
            🔄 Processing your statement with AI...
          </div>
        )}

        {/* File Info */}
        {uploadedFile && !isProcessing && !results && (
          <div className={`text-center mb-4 ${mainText}`}>
            File ready: <span className="font-semibold">{uploadedFile.name}</span>
          </div>
        )}

        {/* Results Section */}
        {results && !isProcessing && (
          <div className="mt-8">
            <h3 className={`text-2xl font-bold mb-6 ${mainText}`}>
              Sync Summary
            </h3>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className={`p-4 rounded-lg border ${borderColor} bg-red-50`}>
                <p className="text-sm text-zinc-700">Total Expenses</p>
                <p className="text-2xl font-bold text-red-700">
                  {results.summary.total_expense ?? results.summary.total}
                </p>
              </div>
              <div
                className={`p-4 rounded-lg border ${borderColor} bg-green-50`}
              >
                <p className="text-sm text-zinc-700">Total Income</p>
                <p className="text-2xl font-bold text-green-700">
                  {results.summary.total_income ?? "₹0.00"}
                </p>
              </div>
              <div className={`p-4 rounded-lg border ${borderColor} bg-blue-50`}>
                <p className="text-sm text-zinc-700">Net</p>
                <p className="text-2xl font-bold text-blue-700">
                  {results.summary.net ?? results.summary.total}
                </p>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="mb-8">
              <h4 className="font-semibold text-lg text-blue-500 mb-3">
                📊 Category Breakdown
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {results.categories.map((cat, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded border ${borderColor} ${
                      theme === "dark" ? "bg-zinc-900" : "bg-zinc-50"
                    }`}
                  >
                    <p className={`text-sm ${subText}`}>{cat.name}</p>
                    <p className={`text-lg font-bold ${mainText}`}>
                      {cat.total}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Main content: table + chat side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left: table */}
              <div className="lg:col-span-2">
                <div className="mb-4">
                  <h4 className={`font-semibold text-lg mb-3 ${mainText}`}>
                    ✏️ Review & Select Transactions
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr
                          className={`${tableHeaderBg} border-b ${borderColor}`}
                        >
                          <th
                            className={`p-2 text-center text-xs font-semibold ${tableHeaderText}`}
                          >
                            Import
                          </th>
                          <th
                            className={`p-2 text-left text-xs font-semibold ${tableHeaderText}`}
                          >
                            Date
                          </th>
                          <th
                            className={`p-2 text-left text-xs font-semibold ${tableHeaderText}`}
                          >
                            Merchant
                          </th>
                          <th
                            className={`p-2 text-left text-xs font-semibold ${tableHeaderText}`}
                          >
                            Category
                          </th>
                          <th
                            className={`p-2 text-left text-xs font-semibold ${tableHeaderText}`}
                          >
                            Type
                          </th>
                          <th
                            className={`p-2 text-right text-xs font-semibold ${tableHeaderText}`}
                          >
                            Amount
                          </th>
                          <th
                            className={`p-2 text-center text-xs font-semibold ${tableHeaderText}`}
                          >
                            Flagged
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {editingExpenses.map((exp) => {
                          const options =
                            exp.type === "debit"
                              ? EXPENSE_CATEGORIES
                              : INCOME_CATEGORIES;

                          return (
                            <tr
                              key={exp.id}
                              className={`border-b ${borderColor} ${tableRowHover}`}
                            >
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={!!exp.include}
                                  onChange={(e) =>
                                    handleIncludeToggle(
                                      exp.id,
                                      e.target.checked
                                    )
                                  }
                                />
                              </td>
                              <td className={`p-2 text-sm ${mainText}`}>
                                {exp.date}
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={exp.merchant}
                                  onChange={(e) =>
                                    handleMerchantChange(
                                      exp.id,
                                      e.target.value
                                    )
                                  }
                                  className={`w-full px-2 py-1 border rounded text-sm ${
                                    theme === "dark"
                                      ? "bg-zinc-900 border-zinc-700 text-zinc-100"
                                      : "bg-white border-zinc-300 text-zinc-900"
                                  }`}
                                />
                              </td>
                              <td className="p-2">
                                <select
                                  value={exp.category}
                                  onChange={(e) =>
                                    handleCategoryChange(
                                      exp.id,
                                      e.target.value
                                    )
                                  }
                                  className={`w-full px-2 py-1 border rounded text-sm ${
                                    theme === "dark"
                                      ? "bg-zinc-900 border-zinc-700 text-zinc-100"
                                      : "bg-white border-zinc-300 text-zinc-900"
                                  }`}
                                >
                                  {options.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2 text-sm font-semibold">
                                <span
                                  className={
                                    exp.type === "debit"
                                      ? "text-red-500"
                                      : "text-green-500"
                                  }
                                >
                                  {exp.type === "debit" ? "Expense" : "Income"}
                                </span>
                              </td>
                              <td className="p-2 text-right font-semibold text-sm">
                                <span
                                  className={
                                    exp.type === "debit"
                                      ? "text-red-500"
                                      : "text-green-500"
                                  }
                                >
                                  {exp.type === "debit" ? "-" : "+"}₹
                                  {exp.amount.toFixed(2)}
                                </span>
                              </td>
                              <td className="p-2 text-center">
                                {exp.flagged ? (
                                  <X
                                    size={18}
                                    className="text-red-500 mx-auto"
                                  />
                                ) : (
                                  <Check
                                    size={18}
                                    className="text-green-500 mx-auto"
                                  />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Unparsed lines */}
                {results.unparsed && results.unparsed.length > 0 && (
                  <div className="mb-4">
                    <h4 className={`font-semibold text-lg mb-3 ${mainText}`}>
                      🧩 Unparsed Lines (Review Manually)
                    </h4>
                    <p className={`text-sm mb-2 ${subText}`}>
                      These lines could not be fully understood by the parser.
                      You can copy them, manually add as transactions, or ignore
                      them.
                    </p>
                    <div
                      className={`max-h-48 overflow-y-auto rounded border ${borderColor} ${
                        theme === "dark" ? "bg-zinc-900" : "bg-zinc-50"
                      }`}
                    >
                      {results.unparsed.map((line, i) => (
                        <div
                          key={i}
                          className="px-3 py-2 border-b last:border-b-0 border-zinc-200 text-xs text-zinc-700 font-mono"
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Import / Cancel */}
                <div className="flex gap-4 mt-4">
                  <button
                    onClick={handleImportExpenses}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition"
                  >
                    ✓ Import Selected
                  </button>
                  <button
                    onClick={() => {
                      setResults(null);
                      setEditingExpenses([]);
                      setUploadedFile(null);
                      setChatMessages([]);
                    }}
                    className="flex-1 bg-zinc-300 hover:bg-zinc-400 text-black font-bold py-3 rounded-lg transition"
                  >
                    ✕ Cancel
                  </button>
                </div>
              </div>

              {/* Right: AI chat panel */}
              <div className="lg:col-span-1">
                <h4 className={`font-semibold text-lg mb-3 ${mainText}`}>
                  🤖 Ask AI about your finances
                </h4>
                <div
                  className={`border ${borderColor} rounded-lg p-3 flex flex-col gap-3 ${
                    theme === "dark" ? "bg-zinc-900" : "bg-zinc-50"
                  } min-h-[350px]`}
                >
                  <div className="max-h-64 overflow-y-auto space-y-2 text-sm">
                    {chatMessages.map((m, idx) => (
                      <div
                        key={idx}
                        className={m.role === "user" ? "text-right" : "text-left"}
                      >
                        <div
                          className={`inline-block px-3 py-2 rounded-lg ${
                            m.role === "user"
                              ? "bg-blue-600 text-white"
                              : theme === "dark"
                              ? "bg-zinc-800 text-zinc-100"
                              : "bg-white text-zinc-900 border border-zinc-200"
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="text-xs text-zinc-500">
                        AI is thinking...
                      </div>
                    )}
                    {!chatMessages.length && !isChatLoading && (
                      <div className="text-xs text-zinc-500">
                        Ask things like “How much did I spend on food this
                        month?” or “What’s my biggest recurring expense?”.
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendChat();
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                        theme === "dark"
                          ? "bg-zinc-950 border-zinc-700 text-zinc-100"
                          : "bg-white border-zinc-300 text-zinc-900"
                      }`}
                      placeholder="Ask about your expenses or income..."
                    />
                    <button
                      onClick={handleSendChat}
                      disabled={isChatLoading}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
