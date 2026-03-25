import HomeScreen from "@/screens/home/HomeScreen";
import { JSX } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

export const AppRoutes = (): JSX.Element => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
      </Routes>
    </BrowserRouter>
  );
};
