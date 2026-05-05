import React from 'react';
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Home from './src/pages/Home.tsx';
import NotFound from './src/pages/NotFound.tsx';
import Analytics from './src/pages/Analytics.tsx';
import Login from './src/pages/Login.tsx';
import Register from './src/pages/Register.tsx';
import ComingSoon from './src/pages/ComingSoon.tsx';

const App: React.FC = () => {
  return (
    <Theme appearance="dark" radius="large" scaling="100%">
      <Router>
        <main className="min-h-screen font-sans selection:bg-purple-500/30">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ComingSoon title="Dashboard" description="Your personal analytics dashboard is coming soon." />} />
            <Route path="/docs" element={<ComingSoon title="API Docs" description="Full API documentation is coming soon." />} />
            <Route path="/pricing" element={<ComingSoon title="Pricing" description="Pricing plans are coming soon." />} />
            <Route path="/privacy" element={<ComingSoon title="Privacy Policy" description="Our privacy policy is being finalized." />} />
            <Route path="/terms" element={<ComingSoon title="Terms of Service" description="Our terms of service are being finalized." />} />
            <Route path="/contact" element={<ComingSoon title="Contact Us" description="Contact page coming soon. Reach us at support@aeoengine.com" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
          />
        </main>
      </Router>
    </Theme>
  );
}

export default App;