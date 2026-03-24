# Project Development Guidelines

These rules ensure consistent architecture and maintainable code across the project.
Tech stack:
React(jsx or tsx) + css, supabase
---

# 1. Styling

follow color instructions form documentation/instructions.md
* Do **not hardcode colors, spacing, or fonts**
* Use **CSS variables**
* Maintain **responsive design**
* Prefer **flex/grid layouts**
* Avoid fixed widths when possible

---

# 2. Frontend Structure

```
frontend/
  src/
    pages/
    components/
    services/
      supabase/
```

Rules:

* `pages/` → one folder per page
* `components/` → reusable global components
* Components should be **small and reusable**

---

# 3. Backend Structure

```
src/
  services/
```

Rules:

* Each service must have **its own folder**
* Services contain **business logic**

---

# 4. Supabase Access

Components **must not call Supabase directly**

Architecture:

```
Component → Service Layer → Supabase
```

This keeps logic centralized and components clean.

---

# 5. AI Services

AI runs as a **separate Python service**

Structure:

```
ai-service/
  main.py
  routes/
  services/
  models/
```

Responsibilities:

* LLM requests
* RAG pipelines
* tool execution
* API endpoints

---

# 6. Overall Project Structure

```
project/

frontend/
  src/
    pages/
    components/
    services/

ai-service/
  main.py
  routes/
  services/
  models/

supabase/
  migrations/

documentation/
```

---

# 7. React & Async Rules

* Each component should have **one responsibility**
* Use **async/await**
* Always use **try/catch**
* Maintain **loading / error states**
* Avoid async directly inside `useEffect`
* Use **TanStack Query or SWR**
* Run independent requests using **Promise.all**
* Debounce user-triggered requests
* Prevent state updates after component unmount
* Keep async logic inside **service layers**
* Avoid blocking the UI thread

---

# 8. Documentation

After implementing features update:

```
documentation/filestructure.md
documentation/services.md
documentation/schemas.md
```

Documentation must always stay **in sync with the codebase**.