import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Extraction from './pages/Extraction';
import Scan from './pages/Scan';
import Validation from './pages/Validation';
import Comparison from './pages/Comparison';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

const AppRouter: React.FC = () => (
    <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/extract" element={<Extraction />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/validation" element={<Validation />} />
        <Route path="/comparison" element={<Comparison />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
    </Routes>
);

export default AppRouter;
