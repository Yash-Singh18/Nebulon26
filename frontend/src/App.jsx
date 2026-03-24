import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home/Home";
import TrackExpense from "./pages/TrackExpense/TrackExpense";
import TeamTracking from "./pages/TeamTracking/TeamTracking";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/track-expense" element={<TrackExpense />} />
        <Route path="/team-tracking" element={<TeamTracking />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
