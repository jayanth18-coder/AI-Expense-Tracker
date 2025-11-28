from fastapi import FastAPI, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import pdfplumber
import tempfile
import re
from typing import List, Dict, Tuple

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok", "message": "AI Expense API running"}

# ---------- helpers ----------

def normalize_amount(raw: str) -> float | None:
    if not raw:
        return None
    clean = (
        str(raw)
        .replace("₹", "")
        .replace("Rs.", "")
        .replace("Rs", "")
        .replace(",", "")
        .strip()
    )
    if not clean or clean == "":
        return None
    try:
        return abs(float(clean))  # always positive
    except ValueError:
        return None

def is_date(value: str) -> bool:
    if not value:
        return False
    value = value.strip()
    return bool(re.match(r"^\d{2}[/-]\d{2}[/-]\d{4}$", value) or re.match(r"^\d{4}-\d{2}-\d{2}$", value))

def detect_column_structure(table: List[List[str]]) -> Dict:
    """
    Analyze table header and first few rows to detect:
    - date column index
    - description column index(es)
    - debit column index
    - credit column index
    - balance column index
    """
    if not table or len(table) < 2:
        return {}
    
    # Look at header row (first row)
    header = [str(cell or "").lower().strip() for cell in table[0]]
    
    structure = {
        "date_idx": -1,
        "desc_start": -1,
        "desc_end": -1,
        "debit_idx": -1,
        "credit_idx": -1,
        "balance_idx": -1,
    }
    
    # Find date column
    for i, h in enumerate(header):
        if "date" in h or "txn" in h:
            structure["date_idx"] = i
            break
    
    # Find debit column
    for i, h in enumerate(header):
        if "debit" in h or "withdrawal" in h or "dr" in h:
            structure["debit_idx"] = i
            break
    
    # Find credit column
    for i, h in enumerate(header):
        if "credit" in h or "deposit" in h or "cr" in h:
            structure["credit_idx"] = i
            break
    
    # Find balance column (usually last numeric column)
    for i in range(len(header) - 1, -1, -1):
        if "balance" in header[i] or "bal" in header[i]:
            structure["balance_idx"] = i
            break
    
    # If no header clues, use positional heuristics by analyzing data rows
    if structure["date_idx"] == -1 or structure["debit_idx"] == -1:
        # Scan first few data rows
        for row_idx in range(1, min(6, len(table))):
            row = [str(cell or "").strip() for cell in table[row_idx]]
            
            # Find date column
            if structure["date_idx"] == -1:
                for i, cell in enumerate(row):
                    if is_date(cell):
                        structure["date_idx"] = i
                        break
            
            # Find numeric columns from the end
            numeric_cols = []
            for i in range(len(row) - 1, -1, -1):
                if normalize_amount(row[i]) is not None:
                    numeric_cols.append(i)
                if len(numeric_cols) >= 3:
                    break
            
            if len(numeric_cols) >= 3:
                numeric_cols = sorted(numeric_cols)
                # Typically: debit, credit, balance (or credit, debit, balance)
                structure["balance_idx"] = numeric_cols[-1]
                structure["debit_idx"] = numeric_cols[0]
                structure["credit_idx"] = numeric_cols[1] if len(numeric_cols) > 1 else -1
                break
    
    # Description is between date and first numeric column
    if structure["date_idx"] != -1 and structure["debit_idx"] != -1:
        structure["desc_start"] = structure["date_idx"] + 1
        structure["desc_end"] = min(structure["debit_idx"], structure["credit_idx"]) if structure["credit_idx"] != -1 else structure["debit_idx"]
    
    return structure

def classify_row_smart(cells: List[str], structure: Dict) -> Tuple[Dict, bool]:
    """
    Classify a row using detected column structure.
    """
    cells = [str(c or "").strip() for c in cells]
    
    if not structure or structure.get("date_idx", -1) == -1:
        return {}, False
    
    date_idx = structure["date_idx"]
    debit_idx = structure.get("debit_idx", -1)
    credit_idx = structure.get("credit_idx", -1)
    desc_start = structure.get("desc_start", date_idx + 1)
    desc_end = structure.get("desc_end", len(cells))
    
    # Extract date
    if date_idx >= len(cells) or not is_date(cells[date_idx]):
        return {}, False
    
    date = cells[date_idx]
    
    # Extract description
    desc_parts = cells[desc_start:desc_end]
    desc = " ".join(d for d in desc_parts if d).strip()
    if not desc:
        desc = "Unknown"
    
    # Extract amounts
    debit_amount = normalize_amount(cells[debit_idx]) if debit_idx != -1 and debit_idx < len(cells) else None
    credit_amount = normalize_amount(cells[credit_idx]) if credit_idx != -1 and credit_idx < len(cells) else None
    
    # Determine type and amount
    tx_type = "debit"
    amount = None
    
    if credit_amount and credit_amount > 0:
        tx_type = "credit"
        amount = credit_amount
    elif debit_amount and debit_amount > 0:
        tx_type = "debit"
        amount = debit_amount
    else:
        # Fallback: if only one column has amount
        if debit_amount:
            amount = debit_amount
            tx_type = "debit"
        elif credit_amount:
            amount = credit_amount
            tx_type = "credit"
        else:
            return {}, False
    
    if amount is None or amount == 0:
        return {}, False
    
    tx = {
        "id": "",
        "date": date,
        "merchant": desc,
        "category": "Other",
        "amount": amount,
        "description": " | ".join(cells),
        "type": tx_type,
        "flagged": amount > 10000,
        "reason": "High amount" if amount > 10000 else "",
    }
    return tx, True

def extract_transactions_with_pdfplumber(pdf_path: str) -> Tuple[List[Dict], List[str]]:
    expenses: List[Dict] = []
    unparsed: List[str] = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            if not tables:
                # fallback: treat each text line as unparsed
                text = page.extract_text() or ""
                for ln in text.splitlines():
                    if ln.strip():
                        unparsed.append(ln.strip())
                continue

            for table_idx, table in enumerate(tables):
                if not table or len(table) < 2:
                    continue
                
                # Detect column structure from this table
                structure = detect_column_structure(table)
                
                # DEBUG: Print structure and first few rows
                print(f"\n=== PAGE {page_num}, TABLE {table_idx} ===")
                print(f"Detected structure: {structure}")
                for i, row in enumerate(table[:5]):
                    print(f"Row {i}: {row}")
                
                # Skip header row(s)
                start_row = 1
                for row in table[start_row:]:
                    if not row:
                        continue
                    
                    tx, ok = classify_row_smart(row, structure)
                    if ok:
                        tx["id"] = f"exp_{len(expenses)}"
                        expenses.append(tx)
                    else:
                        line = " | ".join(str(c or "").strip() for c in row)
                        if line.strip() and not all(c == "" for c in row):
                            unparsed.append(line.strip())

    return expenses, unparsed

# ---------- API endpoints ----------

@app.post("/api/analyze-expenses")
async def analyze_expenses(file: UploadFile = File(...)):
    # Save uploaded PDF to a temporary file
    suffix = ".pdf"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name

    # Extract transactions with pdfplumber
    expenses, unparsed_rows = extract_transactions_with_pdfplumber(tmp_path)

    total_expense = sum(e["amount"] for e in expenses if e["type"] == "debit")
    total_income = sum(e["amount"] for e in expenses if e["type"] == "credit")
    net = total_income - total_expense
    flagged = [e for e in expenses if e["flagged"]]

    summary = {
        "total": f"₹{total_expense:.2f}",
        "transactions": len(expenses),
        "flagged": len(flagged),
        "total_expense": f"₹{total_expense:.2f}",
        "total_income": f"₹{total_income:.2f}",
        "net": f"₹{net:.2f}",
    }

    categories = [
        {
            "name": "Other",
            "total": f"₹{total_expense:.2f}",
        }
    ]

    return {
        "summary": summary,
        "flagged": flagged,
        "categories": categories,
        "expenses": expenses,
        "unparsed": unparsed_rows,
    }

@app.post("/api/import-expenses")
async def import_expenses(req: Request):
    body = await req.json()
    expenses = body.get("expenses", [])
    source_file = body.get("sourceFile", "")
    return {"status": "ok", "imported": len(expenses), "sourceFile": source_file}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3001)
