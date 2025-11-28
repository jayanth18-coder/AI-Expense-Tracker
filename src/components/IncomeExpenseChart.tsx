import { Line } from "react-chartjs-2";
import { Chart, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
Chart.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, "0");
}

function getMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  const dt = new Date(`${year}-${month}-01`);
  return dt.toLocaleString('default', { month: 'long', year: 'numeric' });
}

const lineColors = {
  income: "#fbbf24",
  expenses: "#f472b6"
};

const IncomeExpenseChart = ({ incomes = [], expenses = [], theme = "dark", currency = "₹" }) => {
  // Build {month: total} for income
  const incomeByMonth = {};
  incomes.forEach(e => {
    const key = getMonthKey(e.date);
    incomeByMonth[key] = (incomeByMonth[key] || 0) + Number(e.amount || 0);
  });

  // Build {month: total} for expenses
  const expenseByMonth = {};
  expenses.forEach(e => {
    const key = getMonthKey(e.date);
    expenseByMonth[key] = (expenseByMonth[key] || 0) + Number(e.amount || 0);
  });

  // Union of months present in either data
  const allMonthKeys = Array.from(
    new Set([...Object.keys(incomeByMonth), ...Object.keys(expenseByMonth)])
  ).sort();

  const labels = allMonthKeys.map(getMonthLabel);
  const incomeData = allMonthKeys.map((key) => incomeByMonth[key] || 0);
  const expenseData = allMonthKeys.map((key) => expenseByMonth[key] || 0);

  const data = {
    labels,
    datasets: [
      {
        label: "Income",
        data: incomeData,
        fill: false,
        backgroundColor: lineColors.income,
        borderColor: lineColors.income,
        tension: 0.33,
        pointStyle: 'circle',
        pointRadius: 6,
        pointBackgroundColor: lineColors.income,
        pointBorderWidth: 3,
      },
      {
        label: "Expenses",
        data: expenseData,
        fill: false,
        backgroundColor: lineColors.expenses,
        borderColor: lineColors.expenses,
        tension: 0.33,
        pointStyle: 'circle',
        pointRadius: 6,
        pointBackgroundColor: lineColors.expenses,
        pointBorderWidth: 3,
      }
    ]
  };

  const options = {
    plugins: {
      legend: {
        display: true,
        labels: {
          color: theme === "dark" ? "#fff" : "#232323",
          font: {
            size: 16,
            weight: "bold"
          },
          usePointStyle: true,
          padding: 18
        }
      },
      tooltip: {
        callbacks: {
          // Updated to use dynamic currency
          label: (ctx) => `${ctx.dataset.label}: ${currency}${ctx.formattedValue}`
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: theme === "dark" ? "#fff" : "#232323",
          font: { size: 14, weight: "bold" }
        },
        grid: { color: "#ffffff18" }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: theme === "dark" ? "#fff" : "#232323",
          // Updated to use dynamic currency
          callback: (val) => `${currency}${Number(val).toLocaleString()}`
        },
        grid: { color: "#ffffff18" }
      }
    },
    maintainAspectRatio: false,
    responsive: true
  };

  if (labels.length === 0) {
    return <div className="text-center text-zinc-400 py-8">No data for income or expenses.</div>;
  }

  return (
    <div style={{ minHeight: 410 }}>
      <Line data={data} options={options} />
    </div>
  );
};

export default IncomeExpenseChart;
