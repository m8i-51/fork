import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { LobbyPage } from "./pages/LobbyPage";
import { RoomPage } from "./pages/RoomPage";
import { MonitorPage } from "./pages/MonitorPage";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<LobbyPage />} />
          <Route path="/room/:slug" element={<RoomPage />} />
          <Route path="/admin/monitor" element={<MonitorPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
