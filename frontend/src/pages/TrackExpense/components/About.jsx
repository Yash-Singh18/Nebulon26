import { useState, useEffect } from "react";
import { updateBusiness } from "../../../services/supabase/businesses";
import "./About.css";

function About({ business, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name || "",
        type: business.type || "",
        description: business.description || "",
      });
    }
  }, [business]);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const { business: updated, error } = await updateBusiness(business.id, {
      name: form.name.trim(),
      type: form.type.trim() || null,
      description: form.description.trim() || null,
    });
    setSaving(false);
    if (!error && updated) {
      onUpdate(updated);
      setEditing(false);
    }
  }

  if (!business) return null;

  return (
    <div className="about">
      <div className="about__header">
        <h2 className="about__title">About</h2>
        <button
          className="about__edit-btn"
          onClick={() => (editing ? handleSave() : setEditing(true))}
          disabled={saving}
        >
          {saving ? "Saving..." : editing ? "Save" : "Edit"}
        </button>
      </div>

      <div className="about__card">
        <div className="about__field">
          <label className="about__label">Business Name</label>
          {editing ? (
            <input
              className="about__input"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter business name"
            />
          ) : (
            <p className="about__value">{business.name}</p>
          )}
        </div>

        <div className="about__field">
          <label className="about__label">Business Type</label>
          {editing ? (
            <input
              className="about__input"
              name="type"
              value={form.type}
              onChange={handleChange}
              placeholder="e.g. Retail, SaaS, Consulting"
            />
          ) : (
            <p className="about__value">{business.type || "Not specified"}</p>
          )}
        </div>

        <div className="about__field">
          <label className="about__label">Description</label>
          {editing ? (
            <textarea
              className="about__input about__textarea"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Tell us about your business..."
              rows={5}
            />
          ) : (
            <p className="about__value about__desc">
              {business.description || "No description yet."}
            </p>
          )}
        </div>

        <div className="about__meta">
          <span>Created: {new Date(business.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

export default About;
