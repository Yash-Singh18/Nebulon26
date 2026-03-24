import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home/Home";
import TrackExpense from "./pages/TrackExpense/TrackExpense";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/track-expense" element={<TrackExpense />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
