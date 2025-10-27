import React, { useState, useEffect } from "react";

const ServerStatusWrapper = ({ children }: { children: React.ReactNode }) => {
  const [serverOnline, setServerOnline] = useState(true);

  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/users/health/");
        if (!res.ok) throw new Error("Server error");
        setServerOnline(true);
      } catch (err) {
        setServerOnline(false);
      }
    };

    checkServer(); // first check immediately
    const interval = setInterval(checkServer, 10000); // check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (!serverOnline) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 text-center">
        <h1 className="text-3xl font-bold text-red-600 mb-2">🚨 Server Went Offline</h1>
        <p className="text-gray-700">Please try again later. The backend server is currently unreachable.</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default ServerStatusWrapper;
