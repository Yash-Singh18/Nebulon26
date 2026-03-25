import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home/Home";
import SmeExpert from "./pages/SmeExpert/SmeExpert";
import TrackExpense from "./pages/TrackExpense/TrackExpense";
import TeamTracking from "./pages/TeamTracking/TeamTracking";
import Services from "./pages/Services/Services";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sme-expert" element={<SmeExpert />} />
        <Route path="/track-expense" element={<TrackExpense />} />
        <Route path="/team-tracking" element={<TeamTracking />} />
        <Route path="/services" element={<Services />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
