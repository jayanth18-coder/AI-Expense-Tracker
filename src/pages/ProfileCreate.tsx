import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ProfileCreate() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [annualIncome, setAnnualIncome] = useState("");
  const [occupation, setOccupation] = useState("");
  const [incomeSource, setIncomeSource] = useState("");
  const [monthlyExpense, setMonthlyExpense] = useState("");
  const [savings, setSavings] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(""); // string URL only
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        if (mounted) setUser(session.user);
      }
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (avatarFile) {
      setPreviewUrl(URL.createObjectURL(avatarFile));
      return () => {
        URL.revokeObjectURL(previewUrl);
      };
    }
  }, [avatarFile]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Max file size is 2MB.");
      return;
    }
    setError("");
    setAvatarFile(file);
  };

  // Helper to upload file and get public URL
  async function uploadAvatarFile(file, userId) {
    if (!file || !userId) return "";
    setUploading(true);
    const ext = file.name.split('.').pop();
    const storagePath = `user-avatars/${userId}.${ext}`;
    // Remove previous version (if any)
    await supabase.storage.from("avatars").remove([storagePath]);
    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: true
      });
    if (error || !data) {
      setUploading(false);
      setError("Failed to upload image.");
      return "";
    }
    // GET THE PUBLIC URL (always do this!)
    const { publicUrl } = supabase.storage.from("avatars").getPublicUrl(data.path);
    setUploading(false);
    setAvatarUrl(publicUrl); // set in React state for preview
    return publicUrl;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!user) {
      setError("Not authenticated");
      return;
    }
    let uploadUrl = avatarUrl; // may be "" if not set
    // Only upload if there's a new file chosen
    if (avatarFile) {
      uploadUrl = await uploadAvatarFile(avatarFile, user.id);
      if (!uploadUrl) {
        setError("Failed to save profile picture.");
        return;
      }
    }
    const annualIncomeNumber = annualIncome === "" ? null : Number(annualIncome);
    const monthlyExpenseNumber = monthlyExpense === "" ? null : Number(monthlyExpense);
    const savingsNumber = savings === "" ? null : Number(savings);

    // Always store real URL (or empty string)
    const { error: dbError } = await supabase.from("profiles").upsert({
      user_id: user.id,
      name,
      contact,
      dob,
      address,
      annual_income: annualIncomeNumber,
      occupation,
      income_source: incomeSource,
      monthly_expense: monthlyExpenseNumber,
      savings: savingsNumber,
      avatar_url: uploadUrl, // <-- critical: real publicUrl or ""
    }, { onConflict: ["user_id"] });

    if (dbError) {
      setError(dbError.message || "Could not save profile");
      return;
    }
    navigate("/dashboard");
  };

  const inputStyle = {
    width: "100%",
    height: 44,
    borderRadius: 8,
    paddingLeft: 10,
    background: "#181824",
    color: "#fff",
    border: "1px solid #222",
    fontSize: 15,
    marginBottom: 14
  };
  const labelStyle = { color: "#bbb", fontWeight: 600, fontSize: 15 };

  return (
    <div style={{
      minHeight: "100vh",
      width: "100vw",
      background: "#101013",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        background: "#221d2e",
        borderRadius: 26,
        padding: "38px 48px 32px 48px",
        boxShadow: "0 10px 48px #15161a70",
        maxWidth: 730,
        width: "96vw",
        margin: 36
      }}>
        <h2 style={{
          textAlign: "center",
          fontWeight: 700,
          fontSize: 28,
          color: "#a18cff",
          marginBottom: 14,
          letterSpacing: 0.5
        }}>
          Create Profile
        </h2>
        <form onSubmit={handleSubmit} style={{ width: "100%", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", flexDirection: "column", marginBottom: 22 }}>
            <label htmlFor="avatar-upload" style={{
              display: "block", fontWeight: 600, color: "#bbb", marginBottom: 10
            }}>Profile Photo</label>
            <input
              type="file"
              accept="image/*"
              id="avatar-upload"
              onChange={handleAvatarChange}
              style={{ display: "none" }}
            />
            <label htmlFor="avatar-upload" style={{
              display: "inline-block",
              cursor: "pointer",
              borderRadius: "100px",
              overflow: "hidden",
              border: "3px solid #a18cff",
              width: 92, height: 92, marginBottom: 8,
              background: "#28283a",
              boxShadow: "0 1px 8px #22224244"
            }}>
              <img
                src={previewUrl || avatarUrl || "https://ui-avatars.com/api/?background=random&name=Profile"}
                alt="Avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "100px" }}
              />
            </label>
            <small style={{
              color: "#8686a1",
              fontSize: 13,
              display: "block",
              textAlign: "center",
              marginBottom: 7
            }}>
              Click to upload/change photo (max 2MB)
            </small>
            {uploading && <span style={{ color: '#a18cff', fontSize: 15 }}>Uploading...</span>}
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px 28px"
          }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="Full Name" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Contact Info</label>
              <input value={contact} onChange={e => setContact(e.target.value)} required placeholder="Phone or Email" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date of Birth</label>
              <input value={dob} onChange={e => setDob(e.target.value)} type="date" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Address</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Annual Income</label>
              <input value={annualIncome} onChange={e => setAnnualIncome(e.target.value)} placeholder="Annual Income (e.g., 600000)" type="number" min="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Occupation</label>
              <input value={occupation} onChange={e => setOccupation(e.target.value)} placeholder="Your Profession" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Primary Source of Income</label>
              <input value={incomeSource} onChange={e => setIncomeSource(e.target.value)} placeholder="e.g., Job, Business, Freelancing" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Avg. Monthly Expense</label>
              <input value={monthlyExpense} onChange={e => setMonthlyExpense(e.target.value)} placeholder="Monthly Expense" type="number" min="0" style={inputStyle} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>Savings / Investments (Optional)</label>
              <input value={savings} onChange={e => setSavings(e.target.value)} placeholder="Savings or Investment Amount" type="number" min="0" style={inputStyle} />
            </div>
          </div>
          {error && (
            <div style={{
              color: "#f55",
              fontWeight: 600,
              textAlign: "center",
              marginBottom: 8,
              fontSize: 15,
              marginTop: 8
            }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={uploading}
            style={{
              width: "100%",
              padding: "14px 0",
              background: "linear-gradient(90deg, #a18cff 40%, #9068f6 100%)",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              color: "#fff",
              cursor: uploading ? "not-allowed" : "pointer",
              fontSize: 19,
              marginTop: 25
            }}
          >Save & Continue</button>
        </form>
      </div>
    </div>
  );
}
