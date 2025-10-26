import { useEffect, useState } from 'react';
import { X, Calendar, Bell, BellOff, Menu } from 'lucide-react';
import { supabase, NotificationSetting, UserProfile } from '../lib/supabase';

type NotificationSettingsProps = {
  onNavigate: (view: string) => void;
};

export default function NotificationSettings({ onNavigate }: NotificationSettingsProps) {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const { data: userData } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', '2203A51311@sru.edu.in')
      .maybeSingle();

    if (userData) {
      setUser(userData);
      fetchSettings(userData.id);
    }
  };

  const fetchSettings = async (userId: string) => {
    const { data } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId);

    if (data) {
      setSettings(data);
    }
  };

  const getSettingByType = (type: string) => {
    return settings.find((s) => s.setting_type === type);
  };

  const settingLabels: { [key: string]: { title: string; description: string; items?: string[] } } = {
    due_date: {
      title: 'Due Date',
      description: 'Assignment due date change',
    },
    grading_policies: {
      title: 'Grading policies',
      description: 'Course grading policy change',
    },
    course_content: {
      title: 'Course Content',
      description: 'Change to course content:',
      items: ['Page content', 'Quiz content', 'Assignment content'],
    },
    files: {
      title: 'Files',
      description: 'New file added to your course',
    },
    announcement: {
      title: 'Announcement',
      description: 'New Announcement in your course',
    },
    announcement_created: {
      title: 'Announcement created by you',
      description: '',
      items: ['Announcements created by you', "Replies to announcements you've created"],
    },
    grading: {
      title: 'Grading',
      description: 'Includes:',
      items: ['Assignment/submission grade entered/changed', 'Grade weight changed'],
    },
  };

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
          <span>Notification Settings</span>
        </div>
      </div>

      <div className="flex">
        <div className="w-64 border-r border-gray-200 bg-gray-50 py-6">
          <nav className="space-y-1">
            <div className="px-4 py-2 font-medium bg-gray-200">Notifications</div>
            <button
              onClick={() => onNavigate('profile')}
              className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-100"
            >
              Profile
            </button>
            <button className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-100">
              Files
            </button>
            <button
              onClick={() => onNavigate('settings')}
              className="w-full text-left px-4 py-2 text-blue-600 hover:bg-gray-100"
            >
              Settings
            </button>
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
          <h1 className="text-2xl font-light mb-6">Notification Settings</h1>

          <div className="mb-4 bg-blue-50 border border-blue-200 p-4 flex items-start gap-3">
            <div className="text-blue-600">ℹ️</div>
            <div className="flex-1 text-sm">
              Account-level notifications apply to all courses. Notifications for individual courses can be changed within each course and will override these notifications.
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <div className="mb-4 bg-blue-50 border border-blue-200 p-4 flex items-start gap-3">
            <div className="text-blue-600">ℹ️</div>
            <div className="flex-1 text-sm">
              Daily notifications will be delivered around 18:00. Weekly notifications will be delivered Saturday between 19:30 and 21:30.
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">Settings for</label>
            <select className="border border-gray-300 rounded px-3 py-2 w-64">
              <option>Account</option>
            </select>
          </div>

          <div className="border border-gray-300 rounded">
            <div className="grid grid-cols-3 gap-4 bg-gray-50 border-b border-gray-300 p-4">
              <div className="font-medium">Course activities</div>
              <div className="font-medium text-center">
                <div>Email</div>
                <div className="text-sm font-normal text-gray-600">2203A51311@sru.edu.in</div>
              </div>
              <div className="font-medium text-center">
                <div>Push Notification</div>
                <div className="text-sm font-normal text-gray-600">For all devices</div>
              </div>
            </div>

            {Object.entries(settingLabels).map(([type, label]) => {
              const setting = getSettingByType(type);

              return (
                <div key={type} className="grid grid-cols-3 gap-4 p-4 border-b border-gray-200 last:border-b-0">
                  <div>
                    <div className="font-medium">{label.title}</div>
                    <div className="text-sm text-gray-600">{label.description}</div>
                    {label.items && (
                      <ul className="text-sm text-gray-600 list-disc ml-5 mt-1">
                        {label.items.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex justify-center items-start">
                    {setting?.email_enabled ? (
                      <Calendar size={24} className="text-green-600" />
                    ) : (
                      <Bell size={24} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex justify-center items-start">
                    {setting?.push_enabled ? (
                      <Bell size={24} className="text-green-600" />
                    ) : (
                      <BellOff size={24} className="text-gray-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 bg-gray-50 border border-gray-300 rounded p-4 flex items-start gap-3">
            <input type="radio" className="mt-1" />
            <div className="flex-1">
              <div className="font-medium">
                Include scores when alerting about grades. If your email is not an institution email this means sensitive content will be sent outside of the institution.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
