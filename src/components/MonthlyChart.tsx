import { Bar } from "react-chartjs-2";
import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { useCurrency } from "../components/CurrencyContext";

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// Utility: get yyyy-mm from date string
function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  // Ensures 2-digit month
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

// Display: "Mon yyyy"
function getMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  const dt = new Date(`${year}-${month}-01`);
  return dt.toLocaleString("default", { month: "short", year: "numeric" });
}

const MonthlyChart = ({ expenses = [], theme = "dark" }) => {
  const { currency } = useCurrency(); // "₹", "$", "€", etc.[web:31][web:40]

  // Group by month/year
  const monthMap = {};
  expenses.forEach((e) => {
    const key = getMonthKey(e.date);
    if (!monthMap[key]) monthMap[key] = 0;
    monthMap[key] += Number(e.amount || 0);
  });

  // Sort keys chronologically
  const sortedKeys = Object.keys(monthMap).sort();
  const labels = sortedKeys.map(getMonthLabel);
  const dataArr = sortedKeys.map((key) => monthMap[key]);

  const data = {
    labels,
    datasets: [
      {
        label: `Monthly Spend (${currency})`,
        data: dataArr,
        backgroundColor: "#a78bfa",
        borderRadius: 7,
      },
    ],
  };

  const options = {
    indexAxis: "x",
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => `${currency}${context.parsed.y || 0}`, // dynamic symbol[web:22][web:24]
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: theme === "dark" ? "#eee" : "#232323",
          font: { weight: "bold" },
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: theme === "dark" ? "#eee" : "#232323",
          // optional: also show currency on axis labels
          callback: (value) => `${currency}${value}`, // uses same symbol[web:39]
        },
        grid: { color: "#41407F22" },
      },
    },
    responsive: true,
    maintainAspectRatio: false,
  };

  if (labels.length === 0) {
    return (
      <div className="text-center text-zinc-400 py-8">
        No monthly expenses
      </div>
    );
  }

  return (
    <div style={{ minHeight: 340 }}>
      <Bar data={data} options={options} />
    </div>
  );
};

export default MonthlyChart;
