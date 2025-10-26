import { useEffect, useState } from 'react';
import { User, Menu, Star, Trash2, Edit } from 'lucide-react';
import { supabase, UserProfile } from '../lib/supabase';

type SettingsProps = {
  onNavigate: (view: string) => void;
};

export default function Settings({ onNavigate }: SettingsProps) {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', '2203A51311@sru.edu.in')
      .maybeSingle();

    if (data) {
      setUser(data);
    }
  };

  if (!user) {
    return <div className="flex-1 bg-white">Loading...</div>;
  }

  return (
    <div className="flex-1 bg-white">
      <div className="border-b border-gray-200 px-8 py-4 flex items-center gap-4">
        <button className="p-2 hover:bg-gray-100 rounded">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <button onClick={() => onNavigate('account')} className="text-blue-600 hover:underline">
            2203A51311@sru.edu.in
          </button>
          <span>›</span>
          <span>Settings</span>
        </div>
      </div>

      <div className="flex">
        <div className="w-64 border-r border-gray-200 bg-gray-50 py-6">
          <nav className="space-y-1">
            <button
              onClick={() => onNavigate('notifications')}
              className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-100"
            >
              Notifications
            </button>
            <button
              onClick={() => onNavigate('profile')}
              className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-100"
            >
              Profile
            </button>
            <button className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-100">
              Files
            </button>
            <div className="px-4 py-2 font-medium bg-gray-200">Settings</div>
            <button className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-100">
              ePortfolios
            </button>
            <button className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-100">
              QR for Mobile Login
            </button>
            <button className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-100">
              Global announcements
            </button>
          </nav>
        </div>

        <div className="flex-1 p-8">
          <div className="flex gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                  <User size={32} className="text-gray-400" />
                </div>
                <h1 className="text-2xl font-light">{user.email}'s Settings</h1>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-[200px,1fr] gap-4">
                  <div className="text-right font-medium">Full name:*</div>
                  <div>
                    <div>{user.full_name}</div>
                    <div className="text-sm text-gray-600">This name will be used for grading.</div>
                  </div>
                </div>

                <div className="grid grid-cols-[200px,1fr] gap-4">
                  <div className="text-right font-medium">Display name:</div>
                  <div>
                    <div>{user.display_name}</div>
                    <div className="text-sm text-gray-600">
                      People will see this name in discussions, messages and comments.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[200px,1fr] gap-4">
                  <div className="text-right font-medium">Sortable name:</div>
                  <div>
                    <div>{user.sortable_name}</div>
                    <div className="text-sm text-gray-600">This name appears in sorted lists.</div>
                  </div>
                </div>

                <div className="grid grid-cols-[200px,1fr] gap-4">
                  <div className="text-right font-medium">Pronouns:</div>
                  <div>
                    <div>{user.pronouns}</div>
                    <div className="text-sm text-gray-600">This pronoun will appear after your name when enabled</div>
                  </div>
                </div>

                <div className="grid grid-cols-[200px,1fr] gap-4">
                  <div className="text-right font-medium">Language:</div>
                  <div>{user.language}</div>
                </div>

                <div className="grid grid-cols-[200px,1fr] gap-4">
                  <div className="text-right font-medium">Time Zone:</div>
                  <div>
                    <div>{user.timezone}</div>
                    <div className="text-sm text-gray-600 mt-2">
                      Maintenance windows: 1st and 3rd Thursday of the month from 12:35 to 14:35 (Thursday from 7:05 to 9:05 UTC)
                    </div>
                    <div className="text-sm text-gray-600">
                      Next window: Thu, 6 Nov 2025 from 12:35 to 14:35
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12">
                <h2 className="text-xl font-light mb-6">Web services</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Canvas can make your life a lot easier by tying itself in with the web tools you already use. Click any of the services in "Other services" to see what we mean.
                </p>

                <div className="mb-4">
                  <input type="checkbox" id="services" className="mr-2" defaultChecked />
                  <label htmlFor="services" className="text-sm">
                    Let fellow course/group members see which services I've linked to my profile
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-8 mt-8">
                  <div>
                    <h3 className="font-medium mb-4">Registered services</h3>
                    <p className="text-sm text-gray-600">No registered services</p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-4">Other services</h3>
                    <p className="text-sm text-gray-600 mb-4">Click any service below to register:</p>
                    <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
                      <div className="w-6 h-6 bg-blue-500 rounded"></div>
                      <span>Google Drive</span>
                    </button>
                  </div>
                </div>

                <div className="mt-12">
                  <h3 className="font-medium mb-4">Approved integrations:</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    These are the third-party applications you have authorised to access the Canvas site on your behalf:
                  </p>

                  <table className="w-full border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-300">
                        <th className="text-left p-3 font-medium">App</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Purpose</th>
                        <th className="text-left p-3 font-medium">Dates</th>
                        <th className="text-left p-3 font-medium">Details</th>
                        <th className="text-left p-3 font-medium">Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-300">
                        <td className="p-3">Canvas for Android</td>
                        <td className="p-3">active</td>
                        <td className="p-3"></td>
                        <td className="p-3 text-sm">
                          <div>Expires: never</div>
                          <div>Last used: 19 Apr 2024 at 11:14</div>
                        </td>
                        <td className="p-3">
                          <button className="text-blue-600 hover:underline">details</button>
                        </td>
                        <td className="p-3">
                          <button className="text-gray-600 hover:text-gray-800">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="p-3">Canvas for Android</td>
                        <td className="p-3">active</td>
                        <td className="p-3"></td>
                        <td className="p-3 text-sm">
                          <div>Expires: never</div>
                          <div>Last used: 19 Apr 2024 at 11:16</div>
                        </td>
                        <td className="p-3">
                          <button className="text-blue-600 hover:underline">details</button>
                        </td>
                        <td className="p-3">
                          <button className="text-gray-600 hover:text-gray-800">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="w-80">
              <div className="bg-gray-50 border border-gray-200 rounded p-6">
                <h3 className="font-medium mb-4">Ways to contact</h3>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Email addresses</h4>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">{user.email}</span>
                    <Star size={16} className="text-gray-400" />
                  </div>
                  <button className="text-blue-600 text-sm hover:underline">+ Email address</button>
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Other contacts</h4>
                    <span className="text-sm text-gray-600">Type</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">For all devices</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">push</span>
                      <button className="text-gray-600 hover:text-gray-800">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <button className="text-blue-600 text-sm hover:underline">+ Contact method</button>
                </div>

                <div className="space-y-2">
                  <button className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                    <Edit size={16} />
                    Edit settings
                  </button>
                  <button className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Download submissions
                  </button>
                  <button className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6" />
                    </svg>
                    Pair with observer
                  </button>
                  <button className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Download Course Content
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
