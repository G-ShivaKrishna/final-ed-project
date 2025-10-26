import { X, User, Info } from 'lucide-react';
import { useState } from 'react';

type AccountMenuProps = {
  onClose: () => void;
  onNavigate: (view: string) => void;
};

export default function AccountMenu({ onClose, onNavigate }: AccountMenuProps) {
  const [useHighContrast, setUseHighContrast] = useState(false);
  const [useDyslexiaFont, setUseDyslexiaFont] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50">
      <div className="bg-white w-full max-w-md mt-0 shadow-lg relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded border border-gray-300"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
              <User size={40} className="text-gray-400" />
            </div>
            <div className="text-5xl font-light text-gray-700 mb-2">2</div>
            <div className="text-lg">2203A51311@sru.edu.in</div>
            <button className="mt-4 px-6 py-2 border border-gray-300 rounded hover:bg-gray-50">
              Log out
            </button>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => {
                onNavigate('notifications');
                onClose();
              }}
              className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-50"
            >
              Notifications
            </button>
            <button
              onClick={() => {
                onNavigate('profile');
                onClose();
              }}
              className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-50"
            >
              Profile
            </button>
            <button className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-50">
              Files
            </button>
            <button
              onClick={() => {
                onNavigate('settings');
                onClose();
              }}
              className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-50"
            >
              Settings
            </button>
            <button className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-50">
              ePortfolios
            </button>
            <button className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-50">
              QR for Mobile Login
            </button>
            <button className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-50">
              Global announcements
            </button>
          </nav>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUseHighContrast(!useHighContrast)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${
                    useHighContrast ? 'bg-gray-800' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                      useHighContrast ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  >
                    {useHighContrast && (
                      <X size={16} className="absolute inset-0 m-auto" />
                    )}
                    {!useHighContrast && (
                      <X size={16} className="absolute inset-0 m-auto text-gray-400" />
                    )}
                  </div>
                </button>
                <span className="text-sm">Use High Contrast UI</span>
                <Info size={16} className="text-gray-400" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUseDyslexiaFont(!useDyslexiaFont)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${
                    useDyslexiaFont ? 'bg-gray-800' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                      useDyslexiaFont ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  >
                    {useDyslexiaFont && (
                      <X size={16} className="absolute inset-0 m-auto" />
                    )}
                    {!useDyslexiaFont && (
                      <X size={16} className="absolute inset-0 m-auto text-gray-400" />
                    )}
                  </div>
                </button>
                <span className="text-sm">Use a Dyslexia Friendly Font</span>
                <Info size={16} className="text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
