import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home/Home";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Other routes will be added as pages are built */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
