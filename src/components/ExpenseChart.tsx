import { Pie } from "react-chartjs-2";
import { Chart, ArcElement, Tooltip } from "chart.js";
Chart.register(ArcElement, Tooltip);

const COLORS = [
  "#F87171", "#FBBF24", "#34D399", "#7C3AED", "#60A5FA", "#0284C7", "#F472B6", "#FACC15"
];

const pieLabelsStyle = {
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "center",
  marginTop: 18,
  gap: 28
};

const pieLabelItemStyle = (color) => ({
  display: "flex",
  alignItems: "center",
  fontWeight: 500,
  fontSize: 16,
  gap: 7,
  minWidth: 120,
  color,
  padding: "2px 14px",
  background: "#18181c11",
  borderRadius: 6
});

// Utility: capitalize the first letter
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const ExpenseChart = ({ expenses = [], theme = "dark", currency = "₹" }) => {
  // Group by category
  const categoryMap = {};
  expenses.forEach(e => {
    const cat = e.category || "Other";
    if (!categoryMap[cat]) categoryMap[cat] = 0;
    categoryMap[cat] += Number(e.amount || 0);
  });
  const labels = Object.keys(categoryMap);
  const dataArr = labels.map(cat => categoryMap[cat]);
  const total = dataArr.reduce((sum, v) => sum + v, 0);

  const data = {
    labels,
    datasets: [{
      data: dataArr,
      backgroundColor: COLORS.slice(0, labels.length),
      borderWidth: 3,
      borderColor: "#18181c"
    }]
  };

  const options = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            let label = context.label || "";
            let value = context.parsed || 0;
            let percent = total ? ((value / total) * 100).toFixed(1) : 0;
            // Use dynamic currency here!
            return `${capitalize(label)}: ${currency}${value} (${percent}%)`;
          }
        }
      }
    },
    responsive: true,
    maintainAspectRatio: false
  };

  if (labels.length === 0) {
    return <div className="text-center text-zinc-400 py-10">No expense data</div>;
  }

  return (
    <div style={{
      background: "transparent",
      minHeight: 360,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      width: "100%"
    }}>
      <div style={{
        width: 235, height: 235, margin: "0 auto",
        borderRadius: "50%", boxShadow: "0 2px 24px rgba(80,77,180,0.11)"
      }}>
        <Pie data={data} options={options} />
      </div>
      <div style={pieLabelsStyle}>
        {labels.map((cat, idx) => {
          const value = categoryMap[cat] || 0;
          const percent = total ? ((value / total) * 100).toFixed(1) : 0;
          return (
            <span key={cat} style={pieLabelItemStyle(COLORS[idx % COLORS.length])}>
              <span style={{
                display: "inline-block",
                width: 18, height: 18,
                borderRadius: "50%",
                background: COLORS[idx % COLORS.length],
                marginRight: 8,
                border: "2px solid #222"
              }} />
              <span>
                {capitalize(cat)} • {currency}{value} ({percent}%)
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default ExpenseChart;
