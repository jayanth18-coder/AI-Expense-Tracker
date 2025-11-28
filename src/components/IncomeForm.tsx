import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function IncomeForm({ open, onOpenChange, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    amount: "",
    category: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    time: new Date().toTimeString().slice(0, 5)
  });
  const [categoryError, setCategoryError] = useState(null);

  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function fetchUserCategories() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.id) {
        if (isMounted) setCategories([]);
        return;
      }
      // Fetch all global + user categories, for income
      const { data } = await supabase
        .from("categories")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`);

      const filtered = (data || []).filter(
        c =>
          c.id &&
          c.name &&
          c.name.trim() !== "" &&
          c.type &&
          c.type.toLowerCase() === "income"
      );
      if (isMounted) {
        setCategories(filtered);
        console.log("Fetched income categories, filtered for income:", filtered);
      }
    }
    if (open) {
      fetchUserCategories();
      setFormData({
        amount: "",
        category: "",
        description: "",
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0,5),
      });
    }
    return () => { isMounted = false; };
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.category) {
      setCategoryError("Category is required");
      setLoading(false);
      return;
    }
    setCategoryError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.id) throw new Error("Not authenticated");

      const isoDateTime = `${formData.date}T${formData.time}:00`;

      // Find category by id
      const selectedCategory = categories.find(c => c.id === formData.category);
      if (!selectedCategory || !selectedCategory.name) throw new Error("Invalid category");
      const categoryName = selectedCategory.name;

      const { error } = await supabase.from("income").insert({
        user_id: user.id,
        amount: parseFloat(formData.amount),
        category: categoryName,
        description: formData.description,
        date: isoDateTime
      });

      if (error) throw error;

      toast.success("Income added successfully");
      onSuccess();
      onOpenChange(false);
      setFormData({
        amount: "",
        category: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
        time: new Date().toTimeString().slice(0, 5)
      });
    } catch (error) {
      toast.error(error.message || "Failed to add income");
    } finally {
      setLoading(false);
    }
  };

  // Group defaults (global) and user categories for visual separation
  const defaultCategories = categories.filter(cat => !cat.user_id);
  const userCategories = categories.filter(cat => !!cat.user_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Income</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category <span className="text-red-500">*</span></Label>
            <Select
              value={formData.category}
              onValueChange={(value) => {
                setFormData({ ...formData, category: value });
                setCategoryError(null);
              }}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.length === 0 && (
                  <SelectItem value="_none_" disabled>No categories found</SelectItem>
                )}
                {defaultCategories.length > 0 && (
                  <>
                    <div className="px-3 py-1 text-xs text-gray-400">Defaults</div>
                    {defaultCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </>
                )}
                {userCategories.length > 0 && (
                  <>
                    <div className="px-3 py-1 text-xs text-gray-400">My Categories</div>
                    {userCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
            {categoryError && (
              <div className="text-sm text-red-500 mt-1">{categoryError}</div>
            )}
          </div>
          <div className="space-y-2 flex gap-2">
            <div className="flex-1">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Enter income description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full bg-gradient-success" disabled={loading}>
            {loading ? "Adding..." : "Add Income"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
