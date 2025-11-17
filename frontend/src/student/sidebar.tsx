import { User, Cloud, BookOpen, Users, Calendar, Inbox, Clock, HelpCircle, ChevronLeft } from 'lucide-react';

type SidebarProps = {
  activeView: string;
  onNavigate: (view: string) => void;
};

export default function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const menuItems = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'dashboard', label: 'Dashboard', icon: Cloud },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'groups', label: 'Groups', icon: Users },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'help', label: 'Help', icon: HelpCircle, badge: '10' },
  ];

  return (
    <div className="w-16 bg-[#394B59] text-white flex flex-col items-center py-4 relative">
      <div className="mb-8">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
          <div className="w-8 h-8 bg-[#394B59] rounded-full"></div>
        </div>
      </div>

      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full py-3 flex flex-col items-center gap-1 relative ${
              isActive ? 'bg-[#2C3D4A]' : 'hover:bg-[#2C3D4A]'
            }`}
          >
            <Icon size={20} />
            <span className="text-xs">{item.label}</span>
            {item.badge && (
              <span className="absolute top-2 right-2 bg-gray-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}

      <button className="absolute bottom-4 left-0 w-full py-3 flex justify-center hover:bg-[#2C3D4A]">
        <ChevronLeft size={20} />
      </button>
    </div>
  );
}
