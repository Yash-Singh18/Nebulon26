import { useState } from "react";
import { createProfile } from "../../services/supabase/profiles";
import "./OnboardingModal.css";

function OnboardingModal({ userId, onComplete }) {
  const [form, setForm] = useState({
    name: "",
    username: "",
    phone: "",
    business_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim()) return;

    setLoading(true);
    setError(null);

    const profileData = {
      name: form.name.trim(),
      username: form.username.trim(),
      phone: form.phone.trim() || null,
      business_name: form.business_name.trim() || null,
    };

    const { error: profileError } = await createProfile(userId, profileData);

    if (profileError) {
      setError("Failed to save profile. Please try again.");
      setLoading(false);
      return;
    }

    onComplete();
  }

  return (
    <div className="onboarding__overlay">
      <div className="onboarding__modal">
        <div className="onboarding__header">
          <span className="onboarding__icon">◈</span>
          <h2 className="onboarding__title">Welcome to Sirius</h2>
          <p className="onboarding__subtitle">
            Let's set up your profile to get started
          </p>
        </div>

        <form className="onboarding__form" onSubmit={handleSubmit}>
          <div className="onboarding__field">
            <label htmlFor="name" className="onboarding__label">
              Full Name <span className="onboarding__required">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              className="onboarding__input"
              placeholder="John Doe"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="onboarding__field">
            <label htmlFor="username" className="onboarding__label">
              Username <span className="onboarding__required">*</span>
            </label>
            <input
              id="username"
              name="username"
              type="text"
              className="onboarding__input"
              placeholder="johndoe"
              value={form.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="onboarding__field">
            <label htmlFor="phone" className="onboarding__label">
              Phone Number{" "}
              <span className="onboarding__optional">(optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="onboarding__input"
              placeholder="+1 234 567 8900"
              value={form.phone}
              onChange={handleChange}
            />
          </div>

          <div className="onboarding__field">
            <label htmlFor="business_name" className="onboarding__label">
              Business Name{" "}
              <span className="onboarding__optional">(optional)</span>
            </label>
            <input
              id="business_name"
              name="business_name"
              type="text"
              className="onboarding__input"
              placeholder="Acme Corp"
              value={form.business_name}
              onChange={handleChange}
            />
          </div>

          {error && <p className="onboarding__error">{error}</p>}

          <button
            type="submit"
            className="onboarding__submit"
            disabled={loading || !form.name.trim() || !form.username.trim()}
          >
            {loading ? "Saving..." : "Get Started →"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default OnboardingModal;
